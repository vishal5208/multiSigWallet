require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL
const PRIVATE_KEY_1 = process.env.PRIVATE_KEY_1
const PRIVATE_KEY_2 = process.env.PRIVATE_KEY_2
const PRIVATE_KEY_3 = process.env.PRIVATE_KEY_3
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY

module.exports = {
    defaultNetwork: "hardhat",

    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmations: 1,
        },

        goerli: {
            chainId: 5,
            blockConfirmations: 6,
            url: GOERLI_RPC_URL,
            accounts: [PRIVATE_KEY_1, PRIVATE_KEY_2, PRIVATE_KEY_3],
        },
    },

    solidity: "0.8.13",

    namedAccounts: {
        deployer: {
            default: 0,
            5: 0,
        },
        owner1: {
            default: 1,
            5: 0,
        },
        owner2: {
            default: 2,
            5: 1,
        },
        owner3: {
            default: 3,
            5: 2,
        },
        owner4: {
            default: 4,
            5: 4,
        },
        user: {
            default: 5,
            5: 5,
        },
    },
    etherscan: {
        apiKey: {
            goerli: ETHERSCAN_API_KEY,
        },
    },
    gasReporter: {
        enabled: false,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
        // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },
    mocha: {
        timeout: 300000, // 300 seconds max
    },
}
