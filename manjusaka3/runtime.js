const openpgp = require("./openpgp.min");
const CLUES = require("./clues");
const TYPES = require("./types");

async function decryptPacket(packet, knownClues){
    /* Tries to decrypt a packet. If successful, return { payload: ..., text:
     * ...} as encrypted within ciphertext. Otherwise, returns null */
    var useGroups = [];
    packet.clues.forEach(function(cluegroup){
        var satisfied = true;
        cluegroup.forEach(function(clue){
            if(!knownClues[clue.id] || !knownClues[clue.id].value){
                satisfied = false;
            }
        });
        if(satisfied) useGroups.push(cluegroup);
    });

    // Dependency not satisfied. Cannot decrypt.
    if(useGroups.length < 1) return;

    const passwords = useGroups.map((useGroup) => {
        const cluesArray = useGroup.map((clue) => {
            return {
                id: clue.id,
                value: knownClues[clue.id].value,
            }
        });
        return CLUES.buildPasswordFromClues(cluesArray);
    });


    const ciphertext = Buffer.from(packet.ciphertext, "base64");
    const decrypted = await openpgp.decrypt({
        message: await openpgp.message.read(ciphertext),
        passwords: passwords,
    });
    return JSON.parse(decrypted.data);
}








module.exports = async function* (compilation){
    
    const packets = [
        (TYPES.isString(compilation) ? JSON.parse(compilation): compilation)
    ];
    const clues = {}, assignments = {};

    function collectClues(node){
        // collect the assignment- and declaration-clues
        if(!node.clues) return;
        if(node.cluesCollected) return;
        node.clues.forEach((clueGroup) => {
            clueGroup.forEach((clue) => {
                if(clue.value !== undefined){        // assignment
                    assignments[clue.id] = clue.value;
                } else if (clue.hint !== undefined){ // declaration
                    if(clues[clue.id] === undefined){
                        // never overwrite existing results
                        clues[clue.id] = {
                            "hint": clue.hint,
                            "value": null,
                        };
                    }
                }
            });
        });
        node.cluesCollected = true;
        //console.log("CLUES COLLECTION", clues);
    }

    function updateAssignments(){
        for(var id in assignments){
            if(clues[id] !== undefined){
                clues[id].value = assignments[id];
            }
        };
    }

    function getOpenQuestions(){
        const openQuestions = {};
        for(var id in clues){
            if(!clues[id].value){
                openQuestions[id] = clues[id].hint;
            }
        }
        return openQuestions;
    }


    while(packets.length > 0){

        const openQuestions = getOpenQuestions();
        if(Object.keys(openQuestions).length > 0){
            console.log("Have questions...");
            var answered = false;
            function answerQuestionCallback(answers){
                for(var id in answers){
                    if(clues[id]) clues[id].value = answers[id];
                }
                answered = true;
            }
            
            while(!answered){ // loop here if no answers got
                yield { questions: openQuestions, callback: answerQuestionCallback };
                await new Promise((resolve, _) => setTimeout(resolve, 500));
            }
        }
        
        var unfoldingDone = false;
        while(!unfoldingDone){
            unfoldingDone = true;

            var unfoldPlainDone = false;
            while(!unfoldPlainDone){
                unfoldPlainDone = true;
                for(var i=0; i<packets.length; i++){
                    if(packets[i].type != "plain") continue;
                    collectClues(packets[i]);
                    updateAssignments();

                    if(packets[i].payload){
                        packets[i].payload.forEach((x) => packets.push(x));
                    }
                    if(packets[i].text){
                        yield { text: packets[i].text };
                    }
                    packets.splice(i, 1); // remove this packet.
                    unfoldPlainDone = false;
                    unfoldingDone = false;
                    break;
                }
            }

            var unfoldDecryptDone = false;
            while(!unfoldDecryptDone){
                unfoldDecryptDone = true;
                for(var i=0; i<packets.length; i++){
                    if(packets[i].type != "encrypted") continue;
                    collectClues(packets[i]);
                    updateAssignments();

                    try{
                        const decrypted = await decryptPacket(packets[i], clues);
                        if(decrypted.text){
                            yield { text: decrypted.text };
                        }
                        if(decrypted.payload){
                            decrypted.payload.forEach((x) => packets.push(x));
                        }
                        packets.splice(i, 1); // remove this packet.
                        unfoldPlainDone = false;
                        unfoldingDone = false;
                        break;
                    } catch(e){
                        // continue
                    }
                }
            }

        } // end of loop: unfolding

    }


};
