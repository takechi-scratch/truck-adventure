// 操作画面との接続(Websocket)の準備
const host = `${location.protocol}//${location.host}`;
const questionAPIURL = `${host}/api/question/`;

// URLからクエリパラメータを取得する
const urlParams = new URLSearchParams(window.location.search);

// クエリパラメータが存在するかどうかをチェックする
if (!urlParams.has("position")) {
    console.error("位置のパラメータが見つかりません");
}

if (!urlParams.has("roomID")) {
    console.error("ルームIDのパラメータが見つかりません");
}

const position = urlParams.get("position");
const roomID = urlParams.get("roomID");

// Websocketに接続
const socket = io.connect(host);

const correctSound = new Audio("/static/sound/correct.mp3");
const missSound = new Audio("/static/sound/miss.mp3");

// Canvasを利用するための準備
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Canvasの大きさを指定
canvas.width = window.outerWidth * 2;
canvas.height = window.outerHeight * 2;

const canvasW = canvas.width;
const canvasH = canvas.height;

// いろいろな定数・変数を定義
const indexReadingFrames = 50;
const questionReadingFrames = 150;

let choicedIndex = -1;
let nextTime;
let questionIndex;
let questionsData;
let question;
let x;
let animationNumber = 0;
let animeRatio;
let points;
let isCorrect;
let teamName;
let teamID;
let time;
let message;



// 正方形を描画する関数
function drawSquare(x, y, size, fillStyle, strokeStyle, lineWidth) {
    ctx.beginPath();

    ctx.setLineDash([]);
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.fillRect(x, y, size, size);
    ctx.strokeRect(x, y, size, size);

    ctx.closePath();
    ctx.fill();
}

// 問題の選択肢を描画する関数
function drawChoice(x, y, sizeRatio, text) {
    drawSquare(
        x - Math.min(sizeRatio, 1) * 300,
        y - Math.min(sizeRatio, 1) * 300,
        Math.min(sizeRatio, 1) * 600,
        "#ebebeb", "#824a15", 10
    );

    ctx.beginPath();

    ctx.textAlign = "center";
    // 描画の進み具合によって文字サイズを変える

    const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
    ctx.font = `bold ${Math.min(sizeRatio, 1) * 51}px Roboto medium`;
    ctx.fillStyle = "#000000";
    if (Array.from(segmenter.segment(text)).length <= 10) {
        ctx.fillText(text, x, y);
    } else {
        ctx.fillText(text.substr(0,10), x, y - Math.min(sizeRatio, 1)*50);
        ctx.fillText(text.substr(10,10), x, y + Math.min(sizeRatio, 1)*50);
    }

    ctx.closePath();
    ctx.fill();
}

// 問題枠・点線を描画する関数
function drawQuestionBack() {
    ctx.beginPath();

    ctx.fillStyle = "#8c4808";
    ctx.fillRect(0, 100, canvasW, 200);

    ctx.closePath();
    ctx.fill();

    ctx.beginPath();

    ctx.strokeStyle = "#a6a5a4";
    ctx.lineWidth = 5;
    ctx.setLineDash([10, 25]);
    ctx.lineCap = "round";
    ctx.moveTo(0, 130);
    ctx.lineTo(canvasW, 130);
    ctx.moveTo(0, 270);
    ctx.lineTo(canvasW, 270);

    ctx.closePath();
    ctx.stroke();
}

// 問題を描画する関数
function drawQuestion(question) {
    ctx.textAlign = "center";
    ctx.font = "bold 60px Roboto medium";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(question, canvasW * 0.5, 220);
}


// 問題と選択肢が表示されるときに動く関数
function questionAppearing() {
    x++;
    let sizeRatio = (x - questionReadingFrames - indexReadingFrames) / 75;
    ctx.clearRect(0, 0, canvasW, canvasH); // リセット

    drawQuestionBack();

    if (x > indexReadingFrames) {
        drawQuestion(question["question"]);
    }

    if (x > indexReadingFrames + questionReadingFrames) {
        drawChoice(canvasW * 0.25, canvasH * 0.6, sizeRatio, question["choices"][0]);
        drawChoice(canvasW * 0.75, canvasH * 0.6, sizeRatio, question["choices"][1]);
    }

    if (x < indexReadingFrames + questionReadingFrames + 100) {
        console.log("描画1進行中");
        requestAnimationFrame(questionAppearing); // 繰り返し呼び出す
    }

}

// 選択肢はけ・正誤判定・解説時に動く関数
function questionChoiced() {
    isCorrect = question["choices"][choicedIndex] == question["answer"];
    animationNumber = 0;
    x++;
    if (x < 400) {
        animeRatio = Math.min(x / 20, 1);
    } else {
        animeRatio = Math.min((x - 400) / 30, 1);
    }
    ctx.clearRect(0, 0, canvasW, canvasH); // リセット

    if (x < 150) {    
        drawQuestionBack();
        drawQuestion(question["question"]);

        // 選ばれた方の動き
        drawChoice(canvasW * (animeRatio * 0.25 * (1 - 2 * choicedIndex) + 0.25 * (1 + 2 * choicedIndex)), canvasH * 0.6, 1, question["choices"][choicedIndex]);
        // 選ばれなかった方の動き
        drawChoice(canvasW * (animeRatio * 0.5 * (1 - 2 * choicedIndex) + 0.25 * (3 - 2 * choicedIndex)), canvasH * (0.6 + animeRatio * 0.1), 1, question["choices"][1 - choicedIndex]);
    }

    if (x == 400) {
        if (position == 0) {
            if (isCorrect) {
                correctSound.play();
            } else {
                missSound.play();
            }
        }
        console.log(`${questionIndex+1}番目の問題の正誤を開示しました`);
    }

    if (400 <= x && x < 550) {
        // 正解 or 不正解 の文字のアニメーション
        ctx.beginPath();
        ctx.textAlign = "center";
        ctx.font = `bold ${Math.min(animeRatio, 1) * 300}px Roboto medium`;
        if (isCorrect) {
            ctx.fillStyle = "#fa9420";
            ctx.fillText("正解", canvasW * 0.5, canvasH * 0.5);
        } else {
            ctx.fillStyle = "#0a49d1";
            ctx.fillText("不正解", canvasW * 0.5, canvasH * 0.5);
        }
        ctx.closePath();
        ctx.fill();
    }

    if (550 <= x) {
        ctx.beginPath();

        // 解説の枠
        ctx.setLineDash([]);
        ctx.fillStyle = "#8c4808";
        ctx.fillRect(canvasW * 0.15, canvasH * 0.6, canvasW * 0.7, canvasH * 0.3);

        // 解説文章
        ctx.textAlign = "start";
        ctx.font = `bold 60px Roboto medium`;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(question["feedback"].substr(0,18), canvasW * 0.35, canvasH * 0.7);
        ctx.fillText(question["feedback"].substr(18,18), canvasW * 0.35, canvasH * 0.75);
        ctx.fillText(question["feedback"].substr(36,18), canvasW * 0.35, canvasH * 0.8);
        ctx.fillText(question["feedback"].substr(54,18), canvasW * 0.35, canvasH * 0.85);

    
        ctx.closePath();
        ctx.fill();

        // 正解の選択肢
        drawChoice(canvasW * 0.25, canvasH * 0.75, 0.5, question["answer"]);
    }

    if (x < 600) {
        console.log("描画2進行中");
        requestAnimationFrame(questionChoiced); // 繰り返し呼び出す
    }
}

// 問題終了時に動く関数
function questionEnd() {
    x++;
    let sizeRatio = x / 75;
    ctx.clearRect(0, 0, canvasW, canvasH); // リセット

    ctx.textAlign = "center";
    ctx.font = `bold ${Math.min(sizeRatio, 1) * 300}px Roboto medium`;
    ctx.fillStyle = "#2bc32a";
    ctx.fillText("問題終了", canvasW * 0.5, canvasH * 0.35);

    if (x > 100) {
        // 成績表示の枠
        ctx.setLineDash([]);
        ctx.fillStyle = "#8c4808";
        ctx.fillRect(canvasW * 0.15, canvasH * 0.6, canvasW * 0.7, canvasH * 0.3);

        ctx.textAlign = "start";
        ctx.font = `bold 60px Roboto medium`;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`チーム名：${teamName}`, canvasW * 0.25, canvasH * 0.7);
        ctx.fillText(`最終ポイント：${points}pts`, canvasW * 0.25, canvasH * 0.75);
        ctx.fillText("ありがとうございました！", canvasW * 0.25, canvasH * 0.8);
    }


    ctx.closePath();
    ctx.fill();

    if (x < 500) {
        console.log("描画3進行中");
        requestAnimationFrame(questionEnd); // 繰り返し呼び出す
    } else {
        ctx.clearRect(0, 0, canvasW, canvasH); // リセット
    }

}

// 操作画面と接続できたとき
socket.on("connect", function() {
    console.log("WebSocketの接続完了");
    socket.send("Hello");
    socket.emit("join", roomID);
});

// 操作画面からデータを受信したとき
socket.on("message", function(data) {
    data = JSON.parse(data);
    console.log("受信内容: ", data);
    switch (data["id"]) {
        case 1: 
            // プレイデータの受信
            questionsData = data["questionData"];
            teamName = data["teamName"];
            teamID = data["teamID"];
            console.log("プレイデータを取得しました");
            break;
        
        case 2:
            // 問題スタート
            nextTime = data["nextTime"];
            questionIndex = data["questionNumber"];
            animationNumber = 1;
            console.log("問題開始待機中です");
            break;

        case 3:
            // 選択肢選択済み
            nextTime = data["nextTime"];
            choicedIndex = data["choiced"];
            animationNumber = 2;
            console.log("解答確認待機中です");
            break;

        case 4:
            // クイズ終了
            nextTime = data["nextTime"];
            points = data["points"];
            animationNumber = 3;
            console.log("クイズ終了待機中です");
            break;

        default:
            console.error("idに対応する操作が見つかりません")
    }
});


// 画面が読み込まれたとき
window.addEventListener("DOMContentLoaded", function () {
    // パラメータによって、CSS変数の値を変更
    const container = document.getElementById("container");
    container.style.setProperty("--x--position", Number(position % 2 != 0));
    container.style.setProperty("--y--position", Number(position > 1));

    setInterval(function() {
        socket.send("Ping");
    }, 2000);

    setInterval(function () {
        if (animationNumber != 0 && Date.now() > nextTime) {
            x = 0;

            switch (animationNumber) {
                case 1:
                    question = questionsData[questionIndex];
                    console.log(`${questionIndex}問目の問題表示を開始します`);
                    questionAppearing();
                    break;

                case 2:
                    console.log(`${questionIndex}問目の判定解説を開始します`);
                    questionChoiced();
                    break;

                case 3:
                    console.log("クイズを終了します");
                    questionEnd();
                    break;

                default:
                    console.log("指定されたアニメーションが見つかりません");
            }

            animationNumber = 0;
        }
    }, 30);

});



// 画面をタップしたとき
document.addEventListener("touchstart", function (event) {
    window.location.reload();
}, false);
