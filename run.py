import os
from nieuwburg import create_app, socketio
from nieuwburg.routes.utils import start_dispatch_sweeper

app = create_app()

DEBUG = True

if __name__ == '__main__':
    # Start the Quick Book timeout sweeper exactly once, in the process that
    # actually serves requests:
    #   - reloader ON  (DEBUG)      -> only the worker (WERKZEUG_RUN_MAIN == 'true')
    #   - reloader OFF (not DEBUG)  -> the single process
    # This module is the ONLY server entrypoint, so `flask db ...`/seed.py (which
    # import create_app, not run.py) never start the sweeper.
    use_reloader = DEBUG
    if (not use_reloader) or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        start_dispatch_sweeper(app)
    # We use socketio.run instead of app.run to enable WebSockets
    socketio.run(app, debug=DEBUG, host='0.0.0.0', port=5000)
