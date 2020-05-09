const PARSER = require('fast-xml-parser');
const TYPES = require("./types");
const CLUES = require("./clues");
const Clue = CLUES.Clue;



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
            nodeObj.clues.forEach(function(clueGroup){
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
        this.clues.forEach(function(clueGroup){
            clueGroup.forEach(function(clue){
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
        this.plainChilds.forEach(callback);
        this.encryptedChilds.forEach(callback);
        callback(this);
    }



    compile (){
        // Compile this node. Retuns an object.
        const ret = {
            type: this.nodeType,
            clues: [],
            text: this.text,
        };

        const payload = [];

        this.plainChilds.forEach((e) => { payload.push(e.compile()) });
        this.encryptedChilds.forEach((e) => { payload.push(e.compile()) });

        if(this.nodeType == "plain"){
            ret["payload"] = payload;
        } else {
            // encrypt here TODO
            ret["payload"] = Buffer.from(JSON.stringify(payload)).toString("base64");
        }

        // attach clues

        this.clues.forEach((clueGroup)=>{
            var compiledClues = [];
            clueGroup.forEach((clue)=>{
                compiledClues.push(clue.compile());
            });
            ret.clues.push(compiledClues);
        });

        return ret;
    }
    



}















module.exports = function(xmlstring){
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

    console.log(JSON.stringify(rootnode.compile(), null, "\t"));

    
}
