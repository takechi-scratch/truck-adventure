// 操作画面との接続(Websocket)の準備
const host = `${location.protocol}//${location.host}`;
const questionAPIURL = `${host}/api/question/`;
const sendAPIURL = `${host}/api/send/`;

const HTMLsetting = document.getElementById("setting");
const HTMLcontrol = document.getElementById("control");
const HTMLquestion = document.querySelector(".question");
const HTMLchoice1 = document.querySelector(".choice-1");
const HTMLchoice2 = document.querySelector(".choice-2");
const HTMLhelp = document.querySelector(".help");

const unitPoint = [11, 14, 20];

let questionData;
let questionIndex;
let teamID;
let questionStatus;
let choicedIndex;
let isCorrect;
let corrects;
let roomID;
let points;

function borderReset() {
    HTMLchoice1.style.setProperty("border", "");
    HTMLchoice2.style.setProperty("border", "");
}

function init() {
    questionIndex = -1;
    questionStatus = 0;
    points = 0;
    corrects = 0;
    borderReset();
}

// クイズを取得する関数（ChatGPT）
async function fetchQuestionData(difficulty, questionNumber, category, source) {
    var params = {};
    params["limit"] = Number(questionNumber);
    params["difficulty"] = Number(difficulty);
    if (category != "") {
        params["category"] = category;
    }
    if (source != "") {
        params["source"] = source;
    }

    try {
        console.log(`リクエストURL: ${questionAPIURL}?${new URLSearchParams(params).toString()}`);
        var response = await fetch(`${questionAPIURL}?${new URLSearchParams(params).toString()}`, { method: "GET" });
        if (!response.ok) {
            throw new Error(`HTTPエラーが発生しました ステータス: ${response.status}`);
        }
        var questionDataRaw = await response.json();
        if (questionDataRaw["status"] != "OK") {
            console.error("クイズデータの取得に失敗しました", questionDataRaw);
            return;
        } else {
            console.log("問題生データ", questionDataRaw)
            questionData = []
            questionDataRaw["questions"].forEach(question => {
                questionData.push({
                    "id": question["id"],
                    "question": question["question"],
                    "answer": question["answer"],
                    "choices": question["choices"],
                    "feedback": question["feedback"]
                });
                questionData.at(-1)["choices"].splice(Math.floor(Math.random() * 2) + 1, 1);

                // 半分の確率で問題を入れ替える
                if (Math.random() > 0.5) {
                    var saving = questionData.at(-1)["choices"].at(-1);
                    // 後ろの問題を削除
                    questionData.at(-1)["choices"].pop()
                    // 先頭にもってくる
                    questionData.at(-1)["choices"].unshift(saving)
                }
            });
            console.log("クイズデータ取得");
        }
        return questionData;
    } catch (error) {
        console.error("取得に失敗しました:", error);
        throw error;
    }
}

async function sendPlayData(id, teamName, difficulty, points, questionData) {
    var params = {
        id: Number(id),
        teamName: teamName,
        difficulty: Number(difficulty),
        points: Number(points),
        questionData: questionData
    };

    try {
        console.log(`リクエストURL: ${sendAPIURL}`);
        var response = await fetch(sendAPIURL, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
        if (!response.ok) {
            throw new Error(`HTTPエラーが発生しました ステータス: ${response.status}`);
        }
        var questionDataRaw = await response.json();
        if (questionDataRaw["status"] != "OK") {
            console.error("プレイデータの送信に失敗しました", questionDataRaw);
            return;
        } else {
            console.log("プレイデータの送信完了");
        }
        return questionData;
    } catch (error) {
        console.error("送信に失敗しました:", error);
        throw error;
    }
}


// 画面が読み込まれたとき
window.addEventListener("DOMContentLoaded", function () {
    document.querySelector(".question").innerText = "準備中…";
});

function start() {
    init();

    roomID = HroomID.value;
    // Websocketに接続（あえてのグローバル変数）
    socket = io.connect(host);

    // 操作画面と接続できたとき
    socket.on("connect", function () {
        console.log("WebSocketの接続完了");
        socket.send("Hello");
        socket.emit("join", roomID);
    });

    setInterval(function () {
        socket.send("Ping");
    }, 2000);

    HTMLhelp.innerText = "問題データの取得中です。しばらくお待ちください。";
    console.log("スタート！");
    // 表示項目を変える
    HTMLsetting.style.setProperty("display", "none");
    HTMLcontrol.style.setProperty("display", "block");

    teamID = Math.floor(Date.now() / 1000) % 1000000;

    // クイズデータを取得
    fetchQuestionData(difficulty.value, questionNumber.value, category.value, source.value)
        .then(Data => {
            questionData = Data;
            socket.emit("message", { "id": 1, "roomID": roomID, "questionData": questionData, "teamName": teamName.value, "teamID": teamID });
            HTMLhelp.innerText = "準備が完了しました！スペースキーで問題を開始します。";
            console.log("クイズデータ送信完了");
            questionStatus = 2;
        })

}

function questionWrite(questionIndex, isFeedback) {
    if (isFeedback) {
        HTMLquestion.innerText = questionData[questionIndex]["feedback"];
    } else {
        HTMLquestion.innerText = questionData[questionIndex]["question"];
    }

    HTMLchoice1.innerText = questionData[questionIndex]["choices"][0];
    HTMLchoice2.innerText = questionData[questionIndex]["choices"][1];
}

document.addEventListener("keydown", (event) => {
    // console.log(event.key);

    if (event.key == " " && questionStatus == 2) {
        questionIndex += 1;
        questionStatus = 1;
        HTMLhelp.innerText = "問題を読み上げてください。左右キーで解答を選択します。";
        borderReset();
        questionWrite(questionIndex, false);
        socket.emit("message", { "id": 2, "roomID": roomID, "nextTime": Date.now() + 500, "questionNumber": questionIndex });
    }

    if ((event.key == "ArrowLeft" || event.key == "ArrowRight") && questionStatus == 1) {
        choicedIndex = Number(event.key == "ArrowRight");
        isCorrect = questionData[questionIndex]["choices"][choicedIndex] == questionData[questionIndex]["answer"];

        if (isCorrect) {
            corrects++;
            points += unitPoint[difficulty.value - 1];
        }

        document.querySelector(".HTMLpoint").innerText = points;

        if ((questionIndex >= 4 && corrects <= questionIndex) || questionIndex + 1 >= questionNumber.value) {
            questionStatus = 0;
            HTMLhelp.innerText = "問題は終了です。スペースキーを押して画面を終了させます。";
        } else {
            questionStatus = 2;
            HTMLhelp.innerText = "判定のあと、解説をお願いします。スペースキーで次の問題に移ります。";
        }
        questionWrite(questionIndex, true);
        document.querySelector(`.choice-${choicedIndex + 1}`).style.setProperty("border", `3px solid #${isCorrect ? "fa9420" : "0a49d1"}`);
        socket.emit("message", { "id": 3, "roomID": roomID, "nextTime": Date.now() + 500, "choiced": choicedIndex });
    }

    if ((event.key == "r" && questionStatus != 0) || (event.key == " " && questionStatus == 0)) {
        if (record.checked) {
            HTMLhelp.innerText = "結果を登録しています…";
            sendPlayData(teamID, teamName.value, difficulty.value, points, questionData);
        }

        questionStatus = 0;
        socket.emit("message", { "id": 4, "roomID": roomID, "nextTime": Date.now() + 500, "points": points});
        HTMLhelp.innerText = "操作ありがとうございました！自動で設定画面に戻ります。";
        setTimeout(function() {
            window.location.reload();
        }, 2000);
    }
    document.querySelector(".HTMLquestionIndex").innerText = questionIndex + 1;
});