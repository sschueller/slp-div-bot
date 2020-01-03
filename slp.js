'use strict';

const SLPSDK = require('slp-sdk')
const slpList = require('slp-list').SlpdbQueries;
const fetch = require('node-fetch')

const config = require(__dirname + '/config.json');

const invoiceApiUrl = 'https://pay.bitcoin.com/create_invoice';
const invoiceQrCodeApiUrl = 'https://pay.bitcoin.com/qr/';
const latestBlockInfoApiUrl = 'https://rest.imaginary.cash/v2/blockchain/getBlockchainInfo';
const slpDbApi = 'https://slpdb.bitcoin.com';

const multSLP = 18;
const multBCH = 1e3;

const SLP = new SLPSDK({ restURL: config.bitcoin_com_rest });

// the following is hacked together from minified code found at https://tools.bitcoin.com/slp-dividend-calculator/
let token = {

    getTokenInfo: function (tokenId) {
        return new Promise(function (resolve, reject) {
            (async () => {
                let tokenInfo = await SLP.Utils.list(tokenId);
                if (tokenInfo) {
                    resolve(tokenInfo);
                } else {
                    reject()
                }
            })();
        });
    },

    getAddresses: function (block, slpTokenAddress) {
        return new Promise(function (resolve, reject) {
            slpList.GetAddressListFor(block, slpTokenAddress, slpDbApi).then(function (addresses) {
                resolve(addresses)
            }).catch(error => {
                console.log(error);
                reject()
            });
        });
    },

    getBlockInfo: function () {
        return new Promise(function (resolve, reject) {
            fetch(latestBlockInfoApiUrl)
                .then(res => res.json())
                .then(json => {
                    resolve(json.blocks)
                }).catch(error => {
                    console.log(error)
                    reject()
                });
        });
    },


    filterAddresses: function (addresses, minRequired, maxAllowed) {
        addresses.forEach((function (amount, address) {
            amount.lt(minRequired) && addresses.delete(address);
            if (maxAllowed !== 0) {
                amount.gt(maxAllowed) && addresses.delete(address);
            }
        }));
        return addresses;
    },

    calcuateDividend: function (addresses, dividendTotalAmount, divTypeSLP) {

        let mult = (!divTypeSLP) ? multBCH : multSLP;
        let recipientsList = [];
        let outputs = [];
        let numTransactions = Math.ceil(addresses.size / mult);

        let h = Array.from(addresses.values()).reduce((function (previousValue, currentValue) {
            return previousValue.plus(currentValue)
        }))

        addresses.forEach((function (amount, address) {
            let dividendAmount = amount.div(h).mul(dividendTotalAmount);
            let targetAddress = (!divTypeSLP) ? SLP.Address.toCashAddress(address) : address;
            outputs.push({
                address: targetAddress,
                amount: (!divTypeSLP) ? +Math.floor(1e8 * dividendAmount) : dividendAmount.toString()
            });
            recipientsList.push(targetAddress.toString() + " -> " + dividendAmount.toFixed(8))
        }));

        return {
            numTransactions: numTransactions,
            recipientsList: recipientsList,
            outputs: outputs
        };

    },

    generateTransaction: function (targetTokenId, dividendAmount, minRequired, maxAllowed, airdropTokenId) {

        return new Promise(function (resolve, reject) {

            let divTypeSLP = false
            if (airdropTokenId) {
                divTypeSLP = true;
            }

            let targetTokenInfo;
            let airdropTokenInfo;

            token.getTokenInfo(targetTokenId).then(function (tokenInfo) {
                targetTokenInfo = tokenInfo;
            }).then(async function () {
                if (airdropTokenId) {
                    const tokenInfo = await token.getTokenInfo(airdropTokenId);
                    airdropTokenInfo = tokenInfo;
                } else {
                    return;
                }
            }).then(function () {
                token.getBlockInfo().then(function (json) {

                    token.getAddresses(json.blocks, targetTokenInfo.id).then(function (addresses) {

                        if (minRequired === 0) {
                            minRequired = token.minSlpBalanceForDividend(
                                divTypeSLP,
                                targetTokenInfo.circulatingSupply,
                                dividendAmount,
                                divTypeSLP ? airdropTokenInfo.decimals : 0
                            );
                        }

                        resolve({
                            calcuateDividend: token.calcuateDividend(
                                token.filterAddresses(addresses, minRequired, maxAllowed),
                                dividendAmount,
                                divTypeSLP
                            ),
                            minRequired: minRequired,
                            maxAllowed: maxAllowed,
                            airdropTokenInfo: airdropTokenInfo,
                            targetTokenInfo: targetTokenInfo,
                            divTypeSLP: divTypeSLP,
                            dividendAmount: dividendAmount
                        });

                    }).catch(error => {
                        console.log(error);
                        reject()
                    });
                }).catch(error => {
                    console.log(error)
                    reject()
                });
            }).catch(error => {
                console.log(error)
                reject()
            });
        });

    },

    generateInvoice: function (transactionInfo) {

        return new Promise(function (resolve, reject) {
            let mult = (!transactionInfo.divTypeSLP) ? multBCH : multSLP;

            if (transactionInfo.calcuateDividend.numTransactions <= 25) {

                let invoices = [];

                (async () => {

                    for (let m = 0; m < transactionInfo.calcuateDividend.numTransactions; m += 1) {
                        let memoKey = "", w = [];
                        if (1 === transactionInfo.calcuateDividend.numTransactions)
                            if (!transactionInfo.divTypeSLP) {
                                memoKey = 'memo_single_trans_bch';
                                w = transactionInfo.calcuateDividend.outputs;
                            } else {
                                memoKey = 'memo_single_trans_slp';
                                w = transactionInfo.calcuateDividend.outputs;
                            }

                        else {
                            if (!transactionInfo.divTypeSLP) {
                                memoKey = 'memo_multi_trans_bch';
                            } else {
                                memoKey = 'memo_multi_trans_slp';
                            }

                            var _ = mult * m, S = _ + mult;
                            m === transactionInfo.calcuateDividend.numTransactions && (S = t - _), w = transactionInfo.calcuateDividend.outputs.slice(_, S)
                        }

                        let memo = __(memoKey, {
                            dividendAmount: transactionInfo.dividendAmount,
                            targetTokenId: transactionInfo.targetTokenInfo.id,
                            targetTokenName: transactionInfo.targetTokenInfo.name,
                            minRequired: transactionInfo.minRequired,
                            totalAddresses: transactionInfo.calcuateDividend.outputs.length,
                            airdropTokenId: transactionInfo.divTypeSLP ? transactionInfo.airdropTokenInfo.id : '',
                            airdropTokenName: transactionInfo.divTypeSLP ? transactionInfo.airdropTokenInfo.name : '',
                            numTransactions: transactionInfo.calcuateDividend.numTransactions,
                            m: (m + 1)
                        });

                        let body = {
                            memo: memo
                        };

                        if (transactionInfo.divTypeSLP) {
                            body.token_id = transactionInfo.airdropTokenInfo.id;
                            body.slp_outputs = w;
                        } else {
                            body.outputs = w;
                        }

                        invoices[m] = await fetch(invoiceApiUrl, {
                            method: "POST",
                            headers: {
                                Accept: "application/json",
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(body)
                        }).then((function (e) {
                            return e.json();
                        }
                        )).then(json => {
                            return {
                                paymentUrl: json.paymentUrl,
                                paymentQrCodeUrl: invoiceQrCodeApiUrl + json.paymentId,
                            }
                        }).catch(error => {
                            console.log(error);
                            reject()
                        });
                    }
                    resolve(invoices);
                })();

            } else {
                // too many transactions
                reject('Invoices not generated because this airdrop would require more than 25 transactions to complete. This tool currently supports invoices for airdrops of up to 450 recipients.')
            }
        });
    },

    // cal min slp required for dividend (taken from https://tools.bitcoin.com/slp-dividend-calculator/)
    minSlpBalanceForDividend: function (divTypeSLP, circulatingSupply, dividendAmount, airdropTokenDecimals) {
        let dustLimit = 5e3;
        if (!divTypeSLP) {
            return dustLimit * circulatingSupply / (1e8 * parseFloat(dividendAmount));
        } else {
            return 1 / Math.pow(10, airdropTokenDecimals) * circulatingSupply / dividendAmount
        }
    }

}

module.exports = token;