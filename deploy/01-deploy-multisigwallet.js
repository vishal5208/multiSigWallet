const { network } = require("hardhat")
const { localChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

// deployed at : 0x1108C6126b710aC58EC4a0cAd592e12fbb7493f6

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer, owner1, owner2, owner3 } = await getNamedAccounts()

    const args = [[owner1, owner2, owner3]]

    // console.log(owner1, owner2, owner3)

    const multiSigWallet = await deploy("MultiSigWallet", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    log("MultiSigWallet contract deployed succesfully!!")

    if (!localChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(multiSigWallet.address, args)
    }

    log("********************************************************************************")
}

module.exports.tags = ["multiSigWallet"]
