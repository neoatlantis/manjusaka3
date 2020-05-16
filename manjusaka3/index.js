const compiler = require("./compiler");
const runtime = require("./runtime");

function dieWithUsage(){
    console.log("Usage: node manjusaka2 <compile|run> <input file>");
    process.exit(1);
}

const operator = process.argv[2];
if(!operator) dieWithUsage();

if(operator.slice(0, 1) == "c"){
    compiler(
        require("fs").readFileSync(process.argv[3]).toString()
    ).then(function(result){
        console.log("manjusaka3_webruntime(" + result + ");");
    }).then(()=>process.exit(0));
} else if (operator.slice(0, 1) == "r") {
} else {
    dieWithUsage();    
}
