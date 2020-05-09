const PARSER = require('fast-xml-parser');
const TYPES = require("./types");
const CLUES = require("./clues");
const Clue = CLUES.Clue;
const openpgp = require("./openpgp.min");



class TreeNode {
    
    constructor (parent, nodeType, nodeObj){
        const self = this;
        
        this.parent = parent;
        this.nodeType = nodeType;

        this.text = undefined;
        this.plainChilds = [];
        this.encryptedChilds = [];

        this.rawNode = nodeObj;
        this.clues = [];

        if(undefined !== nodeObj["#text"]){
            this.text = nodeObj["#text"];
        } else if (TYPES.isString(nodeObj)){
            this.text = nodeObj;
        }

        if(nodeObj.plain){
            if(!TYPES.isArray(nodeObj.plain)){
                this.plainChilds.push(
                    new TreeNode(self, "plain", nodeObj.plain)
                );
            } else {
                nodeObj.plain.forEach((o) =>
                    self.plainChilds.push(new TreeNode(self, "plain", o))
                );
            }
        }

        if(nodeObj.encrypted){
            if(!TYPES.isArray(nodeObj.encrypted)){
                this.encryptedChilds.push(
                    new TreeNode(self, "encrypted", nodeObj.encrypted)
                );
            } else {
                nodeObj.encrypted.forEach((o) => self.encryptedChilds.push(
                    new TreeNode(self, "encrypted", o)
                ));
            }
        }

        if(nodeObj.clues){
            if(!TYPES.isArray(nodeObj.clues)) nodeObj.clues = [nodeObj.clues];
            nodeObj.clues.forEach((clueGroup) => {
                var ret = [];
                if(!TYPES.isArray(clueGroup.clue)){
                    ret.push(
                        new Clue(self.nodeType, clueGroup.clue)
                    );
                } else {
                    clueGroup.clue.forEach((clue) => ret.push(
                        new Clue(self.nodeType, clue)
                    ));
                }
                self.clues.push(ret);
            });
        }

    }



    getCluesByType (type){
        const ret = [];
        this.clues.forEach((clueGroup) => {
            clueGroup.forEach((clue) => {
                if(type){
                    if(clue.type == type) ret.push(clue);
                } else {
                    ret.push(clue);
                }
            });
        });
        return ret;
    }



    traverse (callback){
        // apply a callback to all child nodes and this node
        this.plainChilds.forEach((e) => e.traverse(callback));
        this.encryptedChilds.forEach((e) => e.traverse(callback));
        callback(this);
    }



    async compile (){
        // Compile this node. Retuns an object.
        const ret = {
            type: this.nodeType,
            clues: [],
        };

        const payload = [];

        for(var i in this.plainChilds){
            payload.push(await this.plainChilds[i].compile());
        }
        for(var i in this.encryptedChilds){
            payload.push(await this.encryptedChilds[i].compile());
        }

        if(this.nodeType == "plain"){
            if(payload.length > 0) ret["payload"] = payload;
            if(this.text) ret["text"] = this.text;
        } else {
            // encrypt here
            var passwords = CLUES.generateNodeEncryptionKeys(this);
            ret["ciphertext"] = (await openpgp.encrypt({
                message: openpgp.message.fromText(JSON.stringify({
                    "payload": payload,
                    "text": this.text,
                })),
                passwords: passwords,
                armor: false,
                compression: openpgp.enums.compression.zip,
            })).message.packets.write();
            ret["ciphertext"] = Buffer.from(ret["ciphertext"]).toString("base64");
        }

        // attach clues

        this.clues.forEach((clueGroup)=>{
            var compiledClues = [];
            clueGroup.forEach((clue)=>{
                compiledClues.push(clue.compile());
            });
            ret.clues.push(compiledClues);
        });
        if(ret.clues.length < 1) delete ret.clues;

        return ret;
    }
    



}















module.exports = async function(xmlstring){
    const xmldoc = PARSER.parse(xmlstring, {
        ignoreAttributes: false,
    });

    if(!xmldoc.manjusaka){
        throw Error("Input is not likely a Manjusaka file.");
    }

    //console.log(JSON.stringify(xmldoc.manjusaka));

    const rootnode = new TreeNode(null, "plain", xmldoc.manjusaka);

    rootnode.traverse(function(node){
        if(node.nodeType == "encrypted"){
            CLUES.validateNodeClues(node);
        }
    });



    const x = await rootnode.compile();
    return JSON.stringify(x);
}
