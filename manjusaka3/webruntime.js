const $ = require("jquery");

var waitingForAnswer = false;
const answers = {};



function askQuestion(id, question){
    if($('#question-list div[data-id="' + id + '"]').length > 0) return;
    if(answers[id] !== undefined) return;

    const newQuestion = $($('#template [name="question"]')[0].outerHTML);
    newQuestion.attr("data-id", id);
    newQuestion.find('[name="description"]').text(question);

    newQuestion.find("button").click(function(){
        var field = $('div[data-id="' + id + '"]');
        var answer = field.find('input[name="answer"]').val();
        answers[id] = answer;
        field.hide(); // REMOVE TODO
        waitingForAnswer = false;
    });

    newQuestion.appendTo("#question-list");
    waitingForAnswer = true;

    return true;
}

function waitForAnswer(){
    return new Promise(function(resolve, reject){
        function waiter(){
            if(!waitingForAnswer) return resolve();
            setTimeout(waiter, 100);
        }
        waiter();
    });
}


async function main(runtime){
    const emptyRunMax = 100;
    var emptyRun = emptyRunMax;

    while(emptyRun >= 0){
        try{
            const ret = await runtime.next();
            const val = ret.value;
            if(!val) break;

            if(val.text){
                $("<div>").text(val.text).appendTo("body");
                emptyRun = emptyRunMax;
                continue;
            }

            if (val.questions){
                for(var id in val.questions){
                    askQuestion(id, val.questions[id]);
                }
                waitingForAnswer = true;
                await waitForAnswer();
                val.callback(answers);
            } else {
                waitingForAnswer = true;
                await waitForAnswer();
            }


            if(ret.done) break;
        } catch(e){
            console.error(e);
        } finally {
            emptyRun -= 1;
        }
    }
}




module.exports = async function($$$){
    const runtime = require("./runtime")($$$);
    $(()=>main(runtime));
}
