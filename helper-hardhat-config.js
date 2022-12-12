const { ethers } = require("hardhat");

const networkConfig = {
  default: {
    name: "hardhat",
  },
  31337: {
    name: "localhost",
  },
  5: {
    name: "goerli",
  },
};

const localChains = ["hardhat", "localhost"];

module.exports = {
  networkConfig,
  localChains,
};
