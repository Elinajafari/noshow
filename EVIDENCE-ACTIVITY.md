# Evidence: Noshow, second round on GenLayer StudioNet

Every row below was read back from the chain by `scripts/evidence.mjs`: the
sender, the status and the outcome come from the node's answer for each hash,
not from the deployment record. Every outcome on chain matches the record.

- **Contract:** [`0xeC765790E7BBe8F123a4daEd9204F7b6b36766d5`](https://explorer-studio.genlayer.com/address/0xeC765790E7BBe8F123a4daEd9204F7b6b36766d5)
- **Round:** new wallets on the contract already deployed; no deploy in this round
- **The deployment itself:** [EVIDENCE.md](EVIDENCE.md)
- **Transactions:** 4, from 2 different wallets
- **Generated:** 2026-10-18 23:24 UTC

## Wallets

Each wallet was made in memory for this run, and its key was never written
anywhere. Click an address to see every transaction it sent.

| Role | Address | Transactions sent |
|---|---|---|
| restaurant | [`0x22b1664a16fba7D3512445E200739a965F2a4554`](https://explorer-studio.genlayer.com/address/0x22b1664a16fba7D3512445E200739a965F2a4554) | 2 |
| guest | [`0x8df7A965a40D410c6102A83380F0d644c050a3dd`](https://explorer-studio.genlayer.com/address/0x8df7A965a40D410c6102A83380F0d644c050a3dd) | 2 |

## Transactions, in order

"refused" is a transaction the contract was meant to refuse: the committee
agreed on the refusal, and the sentence is the contract's own.

| # | Step | Sent by | Method | On chain | Outcome | Tx |
|---|---|---|---|---|---|---|
| 0 | venue 1: a new restaurant registers, a 0.02 GEN deposit | restaurant [`0x22b1…4554`](https://explorer-studio.genlayer.com/address/0x22b1664a16fba7D3512445E200739a965F2a4554) | `register` | FINALIZED · MAJORITY_AGREE | executed | [`0x154f16f5…02be`](https://explorer-studio.genlayer.com/tx/0x154f16f5ce23bbbf48e1aa5148ccb21d7ab10d028533e22bdbc6b4eaebfa02be) |
| 1 | booking 5: a new guest books | guest [`0x8df7…a3dd`](https://explorer-studio.genlayer.com/address/0x8df7A965a40D410c6102A83380F0d644c050a3dd) | `book` | FINALIZED · MAJORITY_AGREE | executed | [`0x325113cf…0a91`](https://explorer-studio.genlayer.com/tx/0x325113cfc75f8a4422b447f517d2c92fda788799ce48ee9316650833169a0a91) |
| 2 | the restaurant tries to cancel it | restaurant [`0x22b1…4554`](https://explorer-studio.genlayer.com/address/0x22b1664a16fba7D3512445E200739a965F2a4554) | `cancel` | FINALIZED · MAJORITY_AGREE | refused: only the guest may cancel | [`0x475e8f58…6962`](https://explorer-studio.genlayer.com/tx/0x475e8f58456dd90e8e8aac71ea159e4944087cd2f1804f64a521edd5fd496962) |
| 3 | a late cancellation: a cancelled train (expected excused) | guest [`0x8df7…a3dd`](https://explorer-studio.genlayer.com/address/0x8df7A965a40D410c6102A83380F0d644c050a3dd) | `cancel` | FINALIZED · MAJORITY_AGREE | executed | [`0x8a8f480e…1321`](https://explorer-studio.genlayer.com/tx/0x8a8f480eb58ba2d502e47eb25afd142ec0421e4ab157afbdca6507b6dc511321) |
