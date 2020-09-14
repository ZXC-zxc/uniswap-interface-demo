import express = require('express');
import { ChainId, Token, WETH, Fetcher, Trade, Route, TokenAmount, TradeType, Percent } from '@uniswap/sdk'
import Web3 from "web3";
const IUniswapV2Router02 = require("./UniswapV2Router.json");

// Create a new express application instance
const app: express.Application = express();

//list token
app.get('/tokens', (req, res) => {
    var params = req.query;
    res.send(params);
});

//quey tradeinfo for output amount and fee
app.get('/tradeinfo', (req, res) => {
    var params = req.query;
    res.send(params);
});

enum MyTradeType {
    E2T = 0,
    T2E = 1,
    T2T = 2,
}

//get the abi to sign
app.get('/trade', async function(req, res){
    var params = req.query;
    var chainID = 0;
    if (parseInt(params["chainID"] as string) in ChainId) {
        chainID = parseInt(params["chainID"] as string);
    } else {
        res.send("Error chainID");
        return;
    }
    const Token0Address = params["token0Address"] as string;
    const Token1Address = params["token1Address"] as string;
    const FromAddress = params["fromAddress"] as string;
    const ToAddress = params["toAddress"] as string;
    const AmountIn = params["amountIn"] as string;

    const web3 = new Web3(
        new Web3.providers.HttpProvider("https://rinkeby.infura.io/v3/b8cbf70e2eec483c8f367169b22592bd"
        )
    );
    var type = MyTradeType.E2T;

    if(Token0Address == "0x0000000000000000000000000000000000000000" && Token1Address== "0x0000000000000000000000000000000000000000"){
        res.send("Error TokenAddress");
        return;
    }else if(Token0Address == "0x0000000000000000000000000000000000000000"){
        type = MyTradeType.E2T;
    }else if(Token1Address == "0x0000000000000000000000000000000000000000"){
        type = MyTradeType.T2E;
    }else{
        type = MyTradeType.T2T;
    }

    let token0:Token;
    let token1:Token;

    //get tokens
    switch(type){
        case MyTradeType.E2T:
            token0 = WETH[chainID as ChainId];
            token1 = await Fetcher.fetchTokenData(chainID,Token1Address);
            break;
        case MyTradeType.T2E:
            token0 = await Fetcher.fetchTokenData(chainID,Token0Address);
            token1 = WETH[chainID as ChainId];
            break;
        case MyTradeType.T2T:
            token0 = await Fetcher.fetchTokenData(chainID,Token0Address);
            token1 = await Fetcher.fetchTokenData(chainID,Token1Address);
            break;
    }
    
    const pair = await Fetcher.fetchPairData(token0, token1);
    const route = new Route([pair], token0);
    const trade = new Trade(route, new TokenAmount(token0, AmountIn), TradeType.EXACT_INPUT);

    const slippageTolerance = new Percent('50', '10000') // 50 bips, or 0.50%
    const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw // needs to be converted to e.g. hex
    const path = [route.path[0].address,route.path[1].address];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from the current Unix time
    const routerV2Contract = new web3.eth.Contract(IUniswapV2Router02.abi, "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");

    let abi:any;

    switch(type){
    case MyTradeType.E2T:
        abi = routerV2Contract.methods.swapExactETHForTokens(amountOutMin.toString(),path,ToAddress,deadline).encodeABI();
        break;
    case MyTradeType.T2E:
        abi = routerV2Contract.methods.swapExactTokensForETH(amountOutMin.toString(),path,ToAddress,deadline).encodeABI();
        break;
    case MyTradeType.T2T:
        abi = routerV2Contract.methods.swapExactTokensForTokens(AmountIn,amountOutMin.toString(),path,ToAddress,deadline).encodeABI(); 
        break;
    }

    web3.eth.getTransactionCount(FromAddress).then(transactionNonce => {
        let response:any = {};
        response["nonce"] = transactionNonce;
        response["to"] = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
        response["gaslimit"] = 100000;
        response["data"] = abi;
        res.send(response);
    });
    
});

app.listen(3000, () => {
    console.log('Example app listening on port 3000!');
});