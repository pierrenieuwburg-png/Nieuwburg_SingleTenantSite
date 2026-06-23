from nieuwburg import create_app, socketio

app = create_app()

if __name__ == '__main__':
    # We use socketio.run instead of app.run to enable WebSockets
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)