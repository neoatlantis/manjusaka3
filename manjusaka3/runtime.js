const openpgp = require("openpgp");
const CLUES = require("./clues");

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

    try{
        const decrypted = await openpgp.decrypt({
            message: await openpgp.message.read(ciphertext),
            passwords: passwords,
        });
        return JSON.parse(decrypted.data);
    } catch(e){
        console.error(e);
    }
}








module.exports = async function* (compilation){
    
    const packets = [JSON.parse(compilation)];
    const clues = {}, assignments = {};

    function collectClues(nodeClues){
        // collect the assignment- and declaration-clues
        // TODO collect also child nodes
        nodeClues.forEach((clueGroup) => {
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
       
        for(var i=0; i<packets.length; i++){
            if(packets[i].clues && !packets[i].cluesCollected){
                collectClues(packets[i].clues);
                packets[i].cluesCollected = true;
            }
        }


        for(var i=0; i<packets.length; i++){
            if(packets[i].type == "plain"){
                if(packets[i].payload){
                    packets[i].payload.forEach((x) => packets.push(x));
                }
                if(packets[i].text){
                    yield { text: packets[i].text };
                }
                packets.splice(i, 1); // remove this packet.
                break;
            } else {
                const decrypted = await decryptPacket(packets[i], clues);
                if(decrypted){
                    if(decrypted.text){
                        yield { text: decrypted.text };
                    }
                    if(decrypted.payload){
                        decrypted.payload.forEach((x) => packets.push(x));
                    }
                    packets.splice(i, 1); // remove this packet.
                    break;
                }
            }
        }
        updateAssignments();
    }


};
