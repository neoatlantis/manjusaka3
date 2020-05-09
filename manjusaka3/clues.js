/*
A <clue/> have an ID(mandatory), and may have "hint" or "value" depending on
how it's used.

In plain packets:

1. Clues containing only "hint" is a DECLARATION.
2. Clues containing a "value" is an ASSIGNMENT, "hint" when present may be
   ignored.
3. Clues without "hint" or "value" is forbidden and will not pass compilation.

In encrypted packets:

(I) in source code (XML input):
    1. A clue is first declared when both "hint" and "value" presents. This
       "value" is the default for all other references.
    2. Forbidden is, when "hint" is present but no "value" set.
    3. When "hint" is missing, this clue is called a REFERENCE. It's value
       is regarded as default by declaration when no "value" attribute
       presents.
    4. Reference clues contained in a packet, MUST have a corresponding
       DECLARATION found in either (a) one of its parent packets, or (b) a
       sibling plain packet(or its child packets).
    5. In any case, a clue cannot be declared twice.

(II) in compiled structrue:
    1. No "value" attribute may appear as an attribute of a clue. It's value
       will be ignored if found.
    2. A "hint" attribute for a given clue is regarded only at its first
       apperance.
*/


const TYPES = require("./types");

function checkAndReturnClueId(clue){
    const id = clue["@_id"];
    console.log(id);

    if(!id) throw Error("Clue id must be specified: " + JSON.stringify(clue));
    if(!types.isString(id)) throw Error("Clue id invalid: " + clue.id);
}





module.exports.compilePlainClues = function(clues){
    if(!types.isArray(clues)) clues = [clues.clue];
    const ret = [];
    clues.forEach(function(clue){
        const id = checkAndReturnClueId(clue);
        const hint = clue["@_hint"];
        const value = clue["@_value"];

        if(!hint && !value) {
            // only clue Id included: this is reference type, not allowed in
            // plain packets.
            throw Error("Reference clue not allowed in plain packet: " + JSON.stringify(clue));
        }

        ret.push({
            "id": id,
            "value": value,
            "hint": hint,
        });
    });

    return ret;
}



module.exports.validateNodeClues = function(treenode){
    if(treenode.nodeType == "plain") return true; // TODO

    const clues = treenode.getCluesByType("reference");
    var clueDefs = {};
    var pointer = treenode;

    function recordDef(clue){
        if(clueDefs[clue.id] != undefined){
            throw Error(
                "Duplicated declaration of clue: " +
                JSON.stringify(clue)
            );
        }
        clueDefs[clue.id] = clue;
    }

    while(pointer.parent){
        pointer.getCluesByType("declaration").forEach(recordDef);
        pointer = pointer.parent;
    }

    if(treenode.parent){
        treenode.parent.plainChilds.forEach((siblingNode)=>{
            siblingNode.traverse((sn)=>{
                sn.getCluesByType("declaration").forEach(recordDef);
            });
        });
    }


    clues.forEach((clue)=>{
        if(clueDefs[clue.id] == undefined){
            throw Error(
                "Clue reference <" + clue.id + "> has no definition in " +
                "its parent or sibling nodes."
            );
        }
    });

    
}




class Clue {
    
    constructor (context, nodeObj) {
        this.id = nodeObj["@_id"];
        if(undefined == this.id || !TYPES.isString(this.id)){
            throw Error("A <clue /> MUST always have an `id` attribute.");
        }

        this.hint = nodeObj["@_hint"];
        this.value = nodeObj["@_value"];
        this.type = "declaration";

        if("encrypted" == context){ // a clue within a encrypted packet
            if(this.hint){
                if(!this.value){
                    throw Error(
                        "Attempt to declare clue id=" + this.id + " failed. " +
                        "Declaring a <clue /> within encrypted packet must " +
                        "set a default value."
                    );
                }
                // otherwise, this is a declaration.
            } else {
                this.type = "reference";
            }
        } else if("plain" == context){ // a clue within a plain packet
            if(!this.value && !this.hint){
                throw Error(
                    "Plain packets cannot contain reference-typed <clue />."
                );
            } else if (undefined !== this.value) {
                this.type = "assignment";
            }
            // otherwise (this.value == undefined), this is a declaration
        }

        // this.type: ["declaration", "reference" or "assignment"]

    }

    compile (){
        return {
            id: this.id,
            hint: (this.type == "declaration" ? this.hint : undefined),
            value: (this.type == "assignment" ? this.value : undefined),
        }
    }

}

module.exports.Clue = Clue;
