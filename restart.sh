#!/bin/bash

# Params: index
function restart {
    PROCESS_ID=prerender-$1
    PIDFILE=prerender-$1.pid
    LOGFILE=/var/log/prerender/forever.log
    OUTFILE=/var/log/prerender/prerender-$1.log
    ERRFILE=/var/log/prerender/prerender-$1.log
    PRERENDER_ACCESS_LOGS_FILE=/var/log/prerender/access-$1.log
    SCRIPT=server.js
    CACHE_ROOT_DIR=/data/ebs1/prerender-cache/
    PORT=$((4337 + 2 * ($1 - 1)))

    echo "forever stop $PROCESS_ID"
    forever stop $PROCESS_ID

    sleep 2

    echo "PORT=$PORT CACHE_ROOT_DIR=$CACHE_ROOT_DIR PRERENDER_ACCESS_LOGS_FILE=$PRERENDER_ACCESS_LOGS_FILE forever start --uid=$PROCESS_ID --pidFile=$PIDFILE -a -l $LOGFILE -o $OUTFILE -e $ERRFILE $SCRIPT"
    PORT=$PORT CACHE_ROOT_DIR=$CACHE_ROOT_DIR PRERENDER_ACCESS_LOGS_FILE=$PRERENDER_ACCESS_LOGS_FILE forever start --uid=$PROCESS_ID --pidFile=$PIDFILE -a -l $LOGFILE -o $OUTFILE -e $ERRFILE $SCRIPT
}

if [ -z "$1" ]
then
    echo "Usage: `basename $0` [process-index]"
    exit 1
fi

restart $1

