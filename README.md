# SLP Dividend Telegram Bot

## WARNING:
This bot was written in a few hours. There are no tests and it has not been certified to work correctly. Do not use tokens of value with this bot. I take no responsiblity for any lost funds of any kind.

Also note this project is written in Javascript using npm packages which should be consider insecure.

### TODO:
- Cleanup code (remove duplication and minified chunks)
- Tests

## General Information

This bot will ask several questions and then build invoice(s) at bitcoin.com (using https://github.com/Bitcoin-com/Pay.bitcoin.com) to pay dividend or airdrop a SLP token to SLP token holders.

This bot only sends using the last confirmed block. 

WARNING: https://github.com/simpleledger/slp-list is used to get list of token holders and amounts.


### Setup

#### Install required packages
```bash
yarn install
``` 

#### config.json
1. Copy ```config.json.dist``` to ```config.json```
    ```bash
    cp config.json.dist config.json
    ```
2. Adjust ```config.json``` for your needs

#### Create a bot on telegram via the BotFather
Send the following messages to ```@BotFather```
1. ```/newbot``` and follow the prompts to create your bot.
2. Copy the ```token``` into your ```config.json``` for key ```telegramToken```


## Donate

If you like this bot and want to support me, send me some tokens or crypto: 

SLP: 

<img alt="simpleledger:qq0dg8mk42k2czhqv008tsaqj4tf24f3e52whts56e"
     src="https://bwipjs-api.metafloor.com/?bcid=qrcode&text=simpleledger:qq0dg8mk42k2czhqv008tsaqj4tf24f3e52whts56e">

     simpleledger:qq0dg8mk42k2czhqv008tsaqj4tf24f3e52whts56e

BCH:

<img alt="bitcoincash:qp8uwzjfw4nce7terjre80u38kfvcnxf5glm5rv676"
     src="https://bwipjs-api.metafloor.com/?bcid=qrcode&text=bitcoincash:qp8uwzjfw4nce7terjre80u38kfvcnxf5glm5rv676">

     bitcoincash:qp8uwzjfw4nce7terjre80u38kfvcnxf5glm5rv676

BTC:

<img alt="1Lv4Etacsjj1yi3AUGbzZZrcHHhbVbrNkY"
     src="https://bwipjs-api.metafloor.com/?bcid=qrcode&text=1Lv4Etacsjj1yi3AUGbzZZrcHHhbVbrNkY">

     1Lv4Etacsjj1yi3AUGbzZZrcHHhbVbrNkY

ETH:

<img alt="0xe5faC92651dD9Cf6ebab9C8B47d625502B334096"
     src="https://bwipjs-api.metafloor.com/?bcid=qrcode&text=0xe5faC92651dD9Cf6ebab9C8B47d625502B334096">

     0xe5faC92651dD9Cf6ebab9C8B47d625502B334096


