from flask import Flask, render_template, request, jsonify, redirect
from flask_httpauth import HTTPBasicAuth
from flask_socketio import SocketIO, emit, join_room
import json
import urllib.parse
import urllib.request

question_gas_url = "https://script.google.com/macros/s/AKfycbzgkMuKK9cUCAAyrVKK7I91ED0xy5fgpZQ1NRI4_41AAMt9oR57lg8PBgeD9HEEAunk/exec"
send_gas_url = ""
app = Flask(__name__)
app.config.from_object(__name__)
app.config["SECRET_KEY"] = "sadfjopjwepafjpwefjqwofnseovn"
auth = HTTPBasicAuth()
socketio = SocketIO(app)

users = {
    "user": "password"
}


@auth.get_password
def get_pw(username):
    if username in users:
        return users.get(username)
    return None


@app.route("/", methods=["GET"])
@auth.login_required
def home():
    return render_template("index.html")


@app.route("/client/", methods=["GET"])
@auth.login_required
def client():
    return render_template("client.html")


@app.route("/client/play/", methods=["GET"])
# @auth.login_required
def game():
    return render_template("clientPlay.html")


@app.route("/quiz/", methods=["GET"])
@auth.login_required
def quiz():
    return render_template("quiz.html")


@app.route("/api/question/", methods=["GET"])
def get_question_api():
    try:
        params = {}
        for key, value in request.args.items():
            params[key] = value
        query_string = urllib.parse.urlencode(params)
    except Exception as e:
        return jsonify({"status": "エラー10", "error": str(e)})

    try:
        full_url = question_gas_url + "?" + query_string
        response = urllib.request.urlopen(full_url)
        content_type = response.headers.get_content_type()
        if content_type == "application/json":
            response_data = json.loads(response.read().decode("utf-8"))
            return jsonify(response_data)
        else:
            return jsonify({"status": "GASエラー"})
    except Exception as e:
        return jsonify({"status": "エラー2", "error": str(e)})


@app.route("/api/send/", methods=["POST"])
def send_data_api():
    try:
        params = request.json  # Extract parameters from the request body
        if not params:
            raise ValueError("No JSON body provided")
        data = json.dumps(params).encode('utf-8')
        print(data)
    except Exception as e:
        return jsonify({"status": "エラー10", "error": str(e)})

    try:
        req = urllib.request.Request(send_gas_url, data=data, headers={'Content-Type': 'application/json'})
        response = urllib.request.urlopen(req)
        content_type = response.headers.get_content_type()
        if content_type == "application/json":
            response_data = json.loads(response.read().decode("utf-8"))
            return jsonify(response_data)
        else:
            return jsonify({"status": "GASエラー"})
    except Exception as e:
        return jsonify({"status": "エラー2", "error": str(e)})


# ルームに参加
@socketio.on("join")
def join(roomID):
    join_room(str(roomID))


# データの送受信
@socketio.on("message")
def handle_message(data):
    print(data)

    if data not in ["Ping", "Hello"]:
        emit("message", json.dumps(data), to=str(data["roomID"]))


@app.route("/review/")
def review_redirect():
    return redirect("https://docs.google.com/spreadsheets/d/e/2PACX-1vRm4LXcbrvGTY8kO9SNBlXLxitBACmhZO_TXlw1HO2GQFeUxLS_4TTqpq5lDIrlSPkL56v_OgWihMTH/pubhtml?gid=602415105&single=true")


if __name__ == "__main__":
    socketio.run(app, port=10000)
    # これにすると動かなくなります
    # socketio.run(app, debug=True, port=10000, use_reloader=True, log_output=True)
