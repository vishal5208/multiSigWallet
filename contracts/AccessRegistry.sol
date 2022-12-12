// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

error AccessRegistry__OwnerAlreadyExists();
error AccessRegistry__OwnerDoesntExist();
error AccessRegistry__AdminRestrictedFunction();
error AccessRegistry__InvalidOwnerWithZeroAddress();
error AccessRegistry__AtleastThreeInitialSignatoriesRequired();

contract AccessRegistry {
    using SafeMath for uint;

    // Events
    event AdminTransfer(address indexed newAdmin);
    event OwnerAdded(address indexed owner);
    event OwnerRemoval(address indexed owner);
    event LegalMinimum(uint numConfirmationsRequired);

    event Deposit(address indexed sender, uint amount, uint balance);
    event SubmitTransaction(
        address indexed owner,
        uint indexed txIndex,
        address indexed to,
        uint value,
        bytes data
    );
    event ConfirmTransaction(address indexed owner, uint indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint indexed txIndex);

    // about admin
    address public admin;

    // about owners
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint public numConfirmationsRequired;

    constructor(address[] memory _owners) {
        if (_owners.length < 3)
            revert AccessRegistry__AtleastThreeInitialSignatoriesRequired();

        admin = msg.sender;

        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            if (isOwner[owner]) revert AccessRegistry__OwnerAlreadyExists();

            isOwner[owner] = true;
            owners.push(owner);
        }

        uint num = SafeMath.mul(owners.length, 60);
        numConfirmationsRequired = SafeMath.div(num, 100);
    }

    modifier onlyAdmin() {
        if (msg.sender != admin)
            revert AccessRegistry__AdminRestrictedFunction();
        _;
    }

    modifier notNull(address _address) {
        if (_address == address(0))
            revert AccessRegistry__InvalidOwnerWithZeroAddress();
        _;
    }

    modifier notOwnerExists(address owner) {
        if (isOwner[owner]) revert AccessRegistry__OwnerAlreadyExists();
        _;
    }

    modifier ownerExists(address owner) {
        if (!isOwner[owner]) {
            revert AccessRegistry__OwnerDoesntExist();
        }
        _;
    }

    /// @dev add owners (only admin can add owner) and update minimumLegal for excecution of transaction.
    /// @param owner owner's address.
    function addOwner(
        address owner
    ) public onlyAdmin notNull(owner) notOwnerExists(owner) {
        isOwner[owner] = true;
        owners.push(owner);

        emit OwnerAdded(owner);

        updateLegalMinimum(owners.length);
    }

    /// @dev allows an admin to remove owners  and update minimumLegal for excecution of transaction.
    /// @param owner owner's address to remove.
    function removeOwner(
        address owner
    ) public onlyAdmin notNull(owner) ownerExists(owner) {
        isOwner[owner] = false;

        for (uint256 i = 0; i < owners.length - 1; i++)
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                break;
            }
        owners.pop();

        // emit event
        emit OwnerRemoval(owner);

        // update 60% authorization
        updateLegalMinimum(owners.length);
    }

    /// @dev allows admin to transfer ownership.
    /// @param _from address from which ownership is tranferring.
    /// @param _to address to transfer owership.
    function transferOwnership(
        address _from,
        address _to
    )
        public
        onlyAdmin
        notNull(_from)
        notNull(_to)
        ownerExists(_from)
        notOwnerExists(_to)
    {
        for (uint256 i = 0; i < owners.length; i++)
            if (owners[i] == _from) {
                owners[i] = _to;
                break;
            }

        isOwner[_from] = false;
        isOwner[_to] = true;

        // emit events
        emit OwnerRemoval(_from);
        emit OwnerAdded(_to);
    }

    /// @dev allows admin to declare new admin.
    /// @param newAdmin address of the new admin.
    function renounceAdmin(address newAdmin) public onlyAdmin {
        admin = newAdmin;

        emit AdminTransfer(newAdmin);
    }

    /// @dev update MinimumLegal for execution of transaction
    /// @param numOfOwners total number of owners
    function updateLegalMinimum(uint numOfOwners) internal {
        uint num = SafeMath.mul(numOfOwners, 60);
        numConfirmationsRequired = SafeMath.div(num, 100);

        emit LegalMinimum(numConfirmationsRequired);
    }
}
