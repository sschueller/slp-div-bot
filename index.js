#!/usr/bin/env node
"use strict";

require("log-timestamp");

const Telegraf = require('telegraf')
const session = require('telegraf/session')
const Stage = require('telegraf/stage')
const Markup = require('telegraf/markup')
const Scene = require('telegraf/scenes/base')
const i18n = require("i18n");
const Extra = require('telegraf/extra')

const config = require(__dirname + '/config.json');

const { leave } = Stage

i18n.configure({
    locales: [config.language],
    register: global,
    directory: __dirname + '/i18n'
});
i18n.setLocale(config.language);

const token = require(__dirname + '/slp.js');

const bot = new Telegraf(config.telegram_token)

// Telegram Bot Scenes

// what kind of div payment?
const divType = new Scene('div-type')
divType.enter((ctx) => {
    ctx.session.minRequired = 0
    ctx.session.maxAllowed = 0
    ctx.session.airdropTokenId = '';
    ctx.reply('Send dividend payments to SLP token holders',
        Markup.inlineKeyboard([
            Markup.callbackButton('Send BCH', 'bch'),
            Markup.callbackButton('Airdrop SLP Tokens', 'slp'),
            Markup.callbackButton('Cancel', 'cancel')
        ]).extra())
})
divType.action(/bch|slp/, (ctx) => {
    ctx.answerCbQuery();
    ctx.session.divtype = ctx.match.input;
    ctx.scene.enter('slp-token')
})
divType.action('cancel', (ctx) => {
    ctx.answerCbQuery();
    cancelBot(ctx);
})

const slpToken = new Scene('slp-token')
slpToken.enter((ctx) => {
    let msg = 'Enter SLP Token ID to send dividends to. Type /cancel to stop.';
    if (ctx.session.divtype === 'slp') {
        msg = 'Enter SLP Token ID to send airdrop to. Type /cancel to stop.';
    }
    ctx.reply(msg);
})
slpToken.hears(/([A-Fa-f0-9]{64})/gi, function (ctx) {
    ctx.session.slpTarget = ctx.update.message.text;
    if (ctx.session.divtype === 'bch') {
        ctx.scene.enter('dividend-amount')
    } else if (ctx.session.divtype === 'slp') {
        ctx.scene.enter('slp-dividend')
    }
})

const dividendAmount = new Scene('dividend-amount')
dividendAmount.enter((ctx) => {
    ctx.reply('Desired dividend payment amount, to be split between all token holders. Type /cancel to stop.')
})
dividendAmount.hears(/([0-9]{1,8}[\.]{0,1}[0-9]{0,8})/gi, function (ctx) {
    ctx.session.dividendAmount = ctx.update.message.text;
    ctx.scene.enter('extras')
})
dividendAmount.action('cancel', (ctx) => {
    ctx.answerCbQuery();
    cancelBot(ctx);
})

const extras = new Scene('extras')
extras.enter((ctx) => {
    ctx.reply('Additional options. Set minimum required for and/or maximum balance allowed to receive dividend. Press Confirm to continue.',
        Markup.inlineKeyboard([[
            Markup.callbackButton('Set Min (' + ctx.session.minRequired + ')', 'min'),
            Markup.callbackButton('Set Max (' + ctx.session.maxAllowed + ')', 'max')],
        [
            Markup.callbackButton('Confirm', 'confirm'),
            Markup.callbackButton('Cancel', 'cancel')
        ]]).extra())
})
extras.action(/min|max|confirm/, (ctx) => {
    ctx.answerCbQuery();
    if (ctx.match.input === 'min') {
        ctx.scene.enter('min-required')
    } else if (ctx.match.input === 'max') {
        ctx.scene.enter('max-allowed')
    } else if (ctx.match.input === 'confirm') {
        ctx.scene.enter('confirm')
    }
})
extras.action('cancel', (ctx) => {
    ctx.answerCbQuery();
    cancelBot(ctx);
})

const minRequired = new Scene('min-required')
minRequired.enter((ctx) => {
    ctx.reply('Set minimum required for dividend. Set 0 to auto calculate. Type /cancel to stop.')
})
minRequired.hears(/([0-9]{1,8})/gi, function (ctx) {
    ctx.session.minRequired = ctx.update.message.text;
    ctx.scene.enter('extras')
})
minRequired.action('cancel', (ctx) => {
    ctx.answerCbQuery();
    cancelBot(ctx);
})

const maxAllowed = new Scene('max-allowed')
maxAllowed.enter((ctx) => {
    ctx.reply('Set maximum balance allowed to receive dividend. Set 0 for no limit. Type /cancel to stop.')
})
maxAllowed.hears(/([0-9]{1,8})/gi, function (ctx) {
    ctx.session.maxAllowed = ctx.update.message.text;
    ctx.scene.enter('extras')
})
maxAllowed.action('cancel', (ctx) => {
    ctx.answerCbQuery();
    cancelBot(ctx);
})

const slpDiv = new Scene('slp-dividend')
slpDiv.enter((ctx) => {
    ctx.reply('Enter the token ID of the SLP token you would like to airdrop. Type /cancel to stop.')
})
slpDiv.hears(/([A-Fa-f0-9]{64})/gi, function (ctx) {
    ctx.session.airdropTokenId = ctx.update.message.text;
    ctx.scene.enter('dividend-amount')
})
slpDiv.action('cancel', (ctx) => {
    ctx.answerCbQuery();
    cancelBot(ctx);
})

// confirm
const confirm = new Scene('confirm')
confirm.enter((ctx) => {
    let msg = '*Please Confirm the following:*\nDividend Payment of ' +
        ctx.session.dividendAmount +
        ' BCH to holders of `' +
        ctx.session.slpTarget +
        '` based on last confirmed block';

    if (ctx.session.divtype === 'slp') {
        msg = '*Please Confirm the following:*\nAirdrop of ' +
            ctx.session.dividendAmount +
            ' of token `' +
            ctx.session.airdropTokenId +
            '` to holders of `' +
            ctx.session.slpTarget +
            '` based on last confirmed block';
    }

    ctx.replyWithMarkdown(msg,
        Markup.inlineKeyboard([
            Markup.callbackButton('Build Tx', 'yes'),
            Markup.callbackButton('Cancel', 'cancel'),
        ]).extra()
    );

})
confirm.action('yes', (ctx) => {
    ctx.answerCbQuery();
    ctx.scene.enter('generate')
})
confirm.action('cancel', (ctx) => {
    ctx.answerCbQuery();
    cancelBot(ctx);
})

const generate = new Scene('generate')
generate.enter((ctx) => {
    ctx.replyWithMarkdown("`Please wait, building transaction(s) and invoice(s)...`");
    token.generateTransaction(
        ctx.session.slpTarget,
        ctx.session.dividendAmount,
        ctx.session.minRequired,
        ctx.session.maxAllowed,
        ctx.session.airdropTokenId
    ).then(function (transactionInfo) {
        token.generateInvoice(transactionInfo)
            .then(function (invoices) {

                ctx.replyWithMarkdown("*Minimum SLP balance to receive dividend:* " + transactionInfo.minRequired.toString());

                if (transactionInfo.maxAllowed > 0) {
                    ctx.replyWithMarkdown("*Maximum SLP balance to receive dividend:* " + transactionInfo.minRequired.toString());
                }

                let buff = Buffer.from(transactionInfo.calcuateDividend.recipientsList.join("\n"))
                let fileName = transactionInfo.divTypeSLP ? 'airdrop-recipients.txt' : 'dividend-recipients.txt'

                ctx.replyWithDocument({ source: buff, filename: fileName });

                invoices.forEach(function (invoice, index) {
                    ctx.replyWithPhoto(invoice.paymentQrCodeUrl,
                        Extra.caption("(" + (index + 1) + " of " + invoices.length + ")" + invoice.paymentUrl).markdown());
                })
                ctx.scene.leave();
            });
    }).catch(error => {
        console.log(error)
        ctx.replyWithMarkdown("Unable to generate invoice at this time.");
    });

})

// Create scene manager
const stage = new Stage()
stage.command('cancel', (ctx) => {
    cancelBot(ctx);
})

// Scene registration
stage.register(divType)
stage.register(slpToken)
stage.register(dividendAmount)
stage.register(slpDiv)
stage.register(confirm)
stage.register(generate)
stage.register(maxAllowed)
stage.register(minRequired)
stage.register(extras)

bot.use(session())
bot.use(stage.middleware())
bot.command('start', (ctx) => {
    ctx.deleteMessage();
    ctx.scene.enter('div-type')
})
bot.startPolling()

let cancelBot = function (ctx) {
    ctx.reply('Canceled');
    ctx.session.slpTarget = '';
    ctx.session.divtype = '';
    ctx.session.dividendAmount = 0;
    ctx.session.airdropTokenId = '';
    ctx.session.minRequired = 0;
    ctx.session.maxAllowed = 0;
    ctx.scene.leave();
    leave()
};
