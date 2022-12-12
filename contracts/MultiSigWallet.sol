// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./AccessRegistry.sol";

error MultiSigWallet__NotOwner();
error MultiSigWallet__TxDoesNotExist();
error MultiSigWallet__TxAlreadyExecuted();
error MultiSigWallet__TxAlreadyConfirmed();
error MultiSigWallet__CannotExecuteTx(uint required, uint isThereNow);
error MultiSigWallet__TxFailed();
error MultiSigWallet__TxNotConfirmed();

contract MultiSigWallet is AccessRegistry {
    struct Transaction {
        address to;
        uint value;
        bytes data;
        bool executed;
        uint numConfirmations;
    }

    // about transactions
    Transaction[] public transactions;
    mapping(uint => mapping(address => bool)) public isConfirmed;

    // Modifiers

    modifier onlyOwner() {
        if (!isOwner[msg.sender]) revert MultiSigWallet__NotOwner();
        _;
    }

    modifier txExists(uint _txIndex) {
        if (_txIndex >= transactions.length)
            revert MultiSigWallet__TxDoesNotExist();
        _;
    }

    modifier notExecuted(uint _txIndex) {
        if (transactions[_txIndex].executed)
            revert MultiSigWallet__TxAlreadyExecuted();
        _;
    }

    modifier notConfirmed(uint _txIndex) {
        if (isConfirmed[_txIndex][msg.sender])
            revert MultiSigWallet__TxAlreadyConfirmed();
        _;
    }

    constructor(address[] memory _owners) AccessRegistry(_owners) {}

    // functions

    /*
     * Fallback function allows to deposit ether.
     */
    receive() external payable {
        if (msg.value > 0) {
            emit Deposit(msg.sender, msg.value, address(this).balance);
        }
    }

    fallback() external payable {
        if (msg.value > 0) {
            emit Deposit(msg.sender, msg.value, address(this).balance);
        }
    }

    /// @dev Allows any owner to submit a transaction and emits event.
    /// @param _to Transaction target address.
    /// @param _value Transaction ether value.
    /// @param _data Transaction data payload.
    function submitTransaction(
        address _to,
        uint _value,
        bytes memory _data
    ) public onlyOwner {
        uint txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0
            })
        );

        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }

    /// @dev Allows an owner to confirm a transaction and emits event.
    /// @param _txIndex Transaction ID.
    function confirmTransaction(
        uint _txIndex
    )
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    /// @dev Allows an owner to revoke a confirmation for a transaction and emits event.
    /// @param _txIndex Transaction ID.
    function revokeConfirmation(
        uint _txIndex
    ) public onlyOwner txExists(_txIndex) notExecuted(_txIndex) {
        Transaction storage transaction = transactions[_txIndex];

        if (!isConfirmed[_txIndex][msg.sender])
            revert MultiSigWallet__TxNotConfirmed();

        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    /// @dev Allows anyone(one of the owner) to execute a confirmed transaction.
    /// @param _txIndex Transaction ID.
    function executeTransaction(
        uint _txIndex
    ) public onlyOwner txExists(_txIndex) notExecuted(_txIndex) {
        Transaction storage transaction = transactions[_txIndex];

        if (transaction.numConfirmations < numConfirmationsRequired)
            revert MultiSigWallet__CannotExecuteTx(
                numConfirmationsRequired,
                transaction.numConfirmations
            );

        transaction.executed = true;

        if (
            external_call(
                transaction.to,
                transaction.value,
                transaction.data.length,
                transaction.data
            )
        ) emit ExecuteTransaction(msg.sender, _txIndex);
        else {
            revert MultiSigWallet__TxFailed();
        }
    }

    // call has been separated into its own function in order to take advantage
    // of the Solidity's code generator to produce a loop that copies tx.data into memory.
    function external_call(
        address destination,
        uint value,
        uint dataLength,
        bytes memory data
    ) internal returns (bool) {
        bool result;
        assembly {
            let x := mload(0x40) // "Allocate" memory for output (0x40 is where "free memory" pointer is stored by convention)
            let d := add(data, 32) // First 32 bytes are the padded length of data, so exclude that
            result := call(
                sub(gas(), 34710), // 34710 is the value that solidity is currently emitting
                // It includes callGas (700) + callVeryLow (3, to pay for SUB) + callValueTransferGas (9000) +
                // callNewAccountGas (25000, in case the destination address does not exist and needs creating)
                destination,
                value,
                d,
                dataLength, // Size of the input (in bytes) - this is what fixes the padding problem
                x,
                0 // Output is ignored, therefore the output size is zero
            )
        }
        return result;
    }

    // geter functions

    /// @return Returns owners
    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    /// @return Returns total number of transactions
    function getTransactionCount() public view returns (uint) {
        return transactions.length;
    }

    function getTransaction(
        uint _txIndex
    )
        public
        view
        returns (
            address to,
            uint value,
            bytes memory data,
            bool executed,
            uint numConfirmations
        )
    {
        Transaction storage transaction = transactions[_txIndex];

        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }

    /// @return Returns number of confirmations required to carried out the transaction.
    function getLegalMinimum() external view returns (uint256) {
        return numConfirmationsRequired;
    }
}
