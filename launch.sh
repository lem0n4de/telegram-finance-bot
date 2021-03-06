cd telegram-finance-bot/
while [ "$1" != "" ]; do
    PARAM=`echo $1 | awk -F= '{print $1}'`
    VALUE=`echo $1 | awk -F= '{print $2}'`
    case $PARAM in
        -p | --production)
            export PROD=true
            ;;
        -dev | --development)
            export PROD=false
            ;;
        *)
            echo "ERROR: unknown parameter \"$PARAM\""
            exit 1
            ;;
    esac
    shift
done
source ./env.sh
if [ "$?" != 0 ]; then
    echo "No env file found."
    exit 1
fi
git pull
yarn install
ts-node ./node_modules/typeorm/cli.js migration:run
yarn start > telegram-finance-bot.log
