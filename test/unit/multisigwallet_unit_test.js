const { deployments, ethers, getNamedAccounts, network } = require("hardhat")
const { assert, expect } = require("chai")
const { localChains } = require("../../helper-hardhat-config")
const { extendConfig } = require("hardhat/config")

const VALUE = ethers.utils.parseEther("1")
const DATA = "0x"

!localChains.includes(network.name)
    ? describe.skip
    : describe("MultiSigWallet Unit Test", async function () {
          let multiSigWallet, deployer, owners, user
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              accounts = await ethers.getSigners()
              owners = [accounts[1], accounts[2], accounts[3]]
              user = accounts[4]
              await deployments.fixture(["multiSigWallet"])

              multiSigWallet = await ethers.getContract("MultiSigWallet", deployer)
          })

          describe("constructor", async function () {
              it("Owners are initialized correctly", async function () {
                  const contractOwners = await multiSigWallet.getOwners()
                  for (let i = 0; i < contractOwners.length; i++) {
                      assert.equal(contractOwners[i].toString(), owners[i].address)
                  }
              })

              it("Initializes admin correctly", async function () {
                  const admin = await multiSigWallet.admin()
                  assert.equal(deployer, admin)
              })

              it("Initializes number of confirmations according to 60% authentication", async function () {
                  const numOfConfirmations = await multiSigWallet.numConfirmationsRequired()
                  const multiSigOwners = await multiSigWallet.getOwners()
                  const number = Math.floor((multiSigOwners.length * 60) / 100)

                  assert.equal(number.toString(), numOfConfirmations.toString())
              })
          })

          describe("addOwner", function () {
              it("only admin can add the owner", async function () {
                  const owner1ConnectedContract = multiSigWallet.connect(owners[0])
                  await expect(owner1ConnectedContract.addOwner(user.address)).to.be.revertedWith(
                      "AccessRegistry__AdminRestrictedFunction"
                  )
              })

              it("admin adds owner, emits the event and update minimumLegal", async function () {
                  const tx = await multiSigWallet.addOwner(user.address)
                  const txRec = await tx.wait(1)

                  // expected event : OwnerAdded
                  await expect(tx).to.emit(multiSigWallet, "OwnerAdded")

                  // Events emit following
                  assert.equal(txRec.events[0].args.owner, user.address)

                  // check minimum legal
                  const numOfConfirmations = await multiSigWallet.numConfirmationsRequired()
                  const multiSigOwners = await multiSigWallet.getOwners()
                  const number = Math.floor((multiSigOwners.length * 60) / 100)

                  assert.equal(number.toString(), numOfConfirmations.toString())
              })
          })

          describe("removeOwner", function () {
              it("only admin can remove the owner", async function () {
                  const owner1ConnectedContract = multiSigWallet.connect(owners[0])
                  await expect(
                      owner1ConnectedContract.removeOwner(user.address)
                  ).to.be.revertedWith("AccessRegistry__AdminRestrictedFunction")
              })

              it("admin remove the owner, emits the event and update minimumLegal", async function () {
                  // add the new owner and try to remove him
                  const addTx = await multiSigWallet.addOwner(user.address)

                  const tx = await multiSigWallet.removeOwner(user.address)
                  const txRec = await tx.wait(1)

                  // expected event : OwnerRemoval
                  await expect(tx).to.emit(multiSigWallet, "OwnerRemoval")

                  // Events emit following
                  assert.equal(txRec.events[0].args.owner, user.address)

                  // check minimum legal
                  const numOfConfirmations = await multiSigWallet.numConfirmationsRequired()
                  const multiSigOwners = await multiSigWallet.getOwners()
                  const number = Math.floor((multiSigOwners.length * 60) / 100)

                  assert.equal(number.toString(), numOfConfirmations.toString())
              })
          })

          describe("transferOwnership", function () {
              it("only admin can remove the owner", async function () {
                  const owner1ConnectedContract = multiSigWallet.connect(owners[0])
                  await expect(
                      owner1ConnectedContract.transferOwnership(owners[0].address, user.address)
                  ).to.be.revertedWith("AccessRegistry__AdminRestrictedFunction")
              })

              it("transfers ownership and emits 2 emits", async function () {
                  const tx = await multiSigWallet.transferOwnership(owners[0].address, user.address)
                  const txRec = await tx.wait(1)

                  // expected event : OwnerRemoval
                  await expect(tx).to.emit(multiSigWallet, "OwnerRemoval")
                  // Events emit following
                  assert.equal(txRec.events[0].args.owner, owners[0].address)

                  // expected event : OwnerAdded
                  await expect(tx).to.emit(multiSigWallet, "OwnerAdded")
                  // Events emit following
                  assert.equal(txRec.events[1].args.owner, user.address)
              })
          })

          describe("submitTransaction", function () {
              it("At the begining no transaction should be there", async function () {
                  await expect(multiSigWallet.transactions(0)).to.be.reverted
              })

              it("reverts when transaction submitted by address other than owners", async function () {
                  await expect(
                      multiSigWallet.submitTransaction(user.address, VALUE, "0x")
                  ).to.be.revertedWith("MultiSigWallet__NotOwner")
              })

              it("One of the owner submits a transaction and it emits a event", async function () {
                  const owner1ConnectedContract = multiSigWallet.connect(owners[0])
                  const tx = await owner1ConnectedContract.submitTransaction(
                      user.address,
                      VALUE,
                      DATA
                  )

                  // above transaction is not executed yet
                  const transaction = await owner1ConnectedContract.transactions(0)
                  assert.equal(transaction.executed, false)

                  // expected event : SubmitTransaction
                  await expect(tx).to.emit(owner1ConnectedContract, "SubmitTransaction")
                  const txRec = await tx.wait(1)

                  // Events emit following
                  assert.equal(txRec.events[0].args.owner, owners[0].address)
                  assert.equal(txRec.events[0].args.txIndex.toString(), "0")
                  assert.equal(txRec.events[0].args.to, user.address)
                  assert.equal(txRec.events[0].args.value.toString(), VALUE.toString())
                  assert.equal(txRec.events[0].args.data.toString(), DATA.toString())
              })
          })

          describe("confirmTransaction", function () {
              it("reverts when address other than owner tries to confirm the transaction", async function () {
                  await expect(
                      multiSigWallet.submitTransaction(user.address, VALUE, "0x")
                  ).to.be.revertedWith("MultiSigWallet__NotOwner")
              })

              it("reverts when transaction doesn't exist", async function () {
                  const owner1ConnectedContract = multiSigWallet.connect(owners[0])
                  await expect(owner1ConnectedContract.confirmTransaction(0)).to.be.revertedWith(
                      "MultiSigWallet__TxDoesNotExist"
                  )
              })

              it("reverts when transaction confirmed by the same owner that tries to confirm it again", async function () {
                  const owner1ConnectedContract = multiSigWallet.connect(owners[0])
                  const submitTx = await owner1ConnectedContract.submitTransaction(
                      user.address,
                      VALUE,
                      DATA
                  )

                  const confirmTx = await owner1ConnectedContract.confirmTransaction(0)
                  await expect(owner1ConnectedContract.confirmTransaction(0)).to.be.revertedWith(
                      "MultiSigWallet__TxAlreadyConfirmed"
                  )
              })

              it("increase confirmation by one and emits event", async function () {
                  const owner1ConnectedContract = multiSigWallet.connect(owners[0])
                  const submitTx = await owner1ConnectedContract.submitTransaction(
                      user.address,
                      VALUE,
                      DATA
                  )

                  const confirmTx = await owner1ConnectedContract.confirmTransaction(0)

                  const transaction = await owner1ConnectedContract.transactions(0)
                  assert.equal(transaction.numConfirmations.toString(), "1")

                  const isConfirm = await owner1ConnectedContract.isConfirmed(0, owners[0].address)
                  assert(isConfirm)

                  // expected event : ConfirmTransaction
                  await expect(confirmTx).to.emit(owner1ConnectedContract, "ConfirmTransaction")
                  const txRec = await confirmTx.wait(1)

                  // Events emit following
                  assert.equal(txRec.events[0].args.owner, owners[0].address)
                  assert.equal(txRec.events[0].args.txIndex.toString(), "0")
              })
          })

          describe("revokeConfirmation", function () {
              it("reverts when address other than owner tries to revoke the transaction", async function () {
                  await expect(multiSigWallet.revokeConfirmation(0)).to.be.revertedWith(
                      "MultiSigWallet__NotOwner"
                  )
              })

              it("reverts when transaction doesn't exist", async function () {
                  const owner1ConnectedContract = multiSigWallet.connect(owners[0])
                  await expect(owner1ConnectedContract.confirmTransaction(0)).to.be.revertedWith(
                      "MultiSigWallet__TxDoesNotExist"
                  )
              })

              it("reverts when transaction not confirmed by the current owner who tries to revoke the comfirmation", async function () {
                  const owner1ConnectedContract = multiSigWallet.connect(owners[0])
                  const submitTx = await owner1ConnectedContract.submitTransaction(
                      user.address,
                      VALUE,
                      DATA
                  )

                  await expect(owner1ConnectedContract.revokeConfirmation(0)).to.be.revertedWith(
                      "MultiSigWallet__TxNotConfirmed"
                  )
              })

              it("revokes confirmation and emits the event", async function () {
                  const owner1ConnectedContract = multiSigWallet.connect(owners[0])
                  const submitTx = await owner1ConnectedContract.submitTransaction(
                      user.address,
                      VALUE,
                      DATA
                  )

                  // confirm the transaction
                  const confirmTx = await owner1ConnectedContract.confirmTransaction(0)

                  // revoke the confirmed transaction
                  const revokeTx = await owner1ConnectedContract.revokeConfirmation(0)
                  const txRec = await revokeTx.wait(1)

                  // expected event : RevokeConfirmation
                  await expect(revokeTx).to.emit(owner1ConnectedContract, "RevokeConfirmation")

                  // Events emit following
                  assert.equal(txRec.events[0].args.owner, owners[0].address)
                  assert.equal(txRec.events[0].args.txIndex.toString(), "0")
              })
          })

          describe("executeTransaction", function () {
              it("reverts when address other than owner tries to execute the transaction", async function () {
                  await expect(multiSigWallet.executeTransaction(0)).to.be.revertedWith(
                      "MultiSigWallet__NotOwner"
                  )
              })

              it("reverts when transaction doesn't exist", async function () {
                  const owner1ConnectedContract = multiSigWallet.connect(owners[0])
                  await expect(owner1ConnectedContract.executeTransaction(0)).to.be.revertedWith(
                      "MultiSigWallet__TxDoesNotExist"
                  )
              })

              it("reverts when owner tries to execute the transaction that have less confirmations than required", async function () {
                  const owner1ConnectedContract = multiSigWallet.connect(owners[0])
                  const submitTx = await owner1ConnectedContract.submitTransaction(
                      user.address,
                      VALUE,
                      DATA
                  )

                  //const confirmTx = await owner1ConnectedContract.confirmTransaction(0)

                  await expect(owner1ConnectedContract.executeTransaction(0)).to.be.revertedWith(
                      "MultiSigWallet__CannotExecuteTx"
                  )
              })

              it("reverts because contract does not enough balance to execute the transaction", async function () {
                  const owner1ConnectedContract = multiSigWallet.connect(owners[0])
                  const submitTx = await owner1ConnectedContract.submitTransaction(
                      user.address,
                      VALUE,
                      DATA
                  )

                  const confirmTx = await owner1ConnectedContract.confirmTransaction(0)

                  await expect(owner1ConnectedContract.executeTransaction(0)).to.be.revertedWith(
                      "MultiSigWallet__TxFailed"
                  )
              })

              it("executes the transaction and emits the event", async function () {
                  // fund the contract with 10 ether

                  const tx = {
                      from: owners[0].address,
                      to: multiSigWallet.address,
                      value: ethers.utils.parseEther("10"),
                  }
                  await owners[0].sendTransaction(tx)

                  const owner1ConnectedContract = multiSigWallet.connect(owners[0])

                  const submitTx = await owner1ConnectedContract.submitTransaction(
                      user.address,
                      VALUE,
                      DATA
                  )

                  const confirmTx = await owner1ConnectedContract.confirmTransaction(0)

                  const executeTx = await owner1ConnectedContract.executeTransaction(0)
                  const txRec = await executeTx.wait(1)

                  //  expected event : ExecuteTransaction
                  await expect(executeTx).to.emit(owner1ConnectedContract, "ExecuteTransaction")

                  // Events emit the following
                  assert.equal(txRec.events[0].args.owner, owners[0].address)
                  assert.equal(txRec.events[0].args.txIndex.toString(), "0")
              })
          })
      })
