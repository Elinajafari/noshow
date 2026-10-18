# Evidence: Noshow on GenLayer StudioNet

Every row below was read back from the chain by `scripts/evidence.mjs`: the
sender, the status and the outcome come from the node's answer for each hash,
not from the deployment record. Every outcome on chain matches the record.

- **Contract:** [`0xeC765790E7BBe8F123a4daEd9204F7b6b36766d5`](https://explorer-studio.genlayer.com/address/0xeC765790E7BBe8F123a4daEd9204F7b6b36766d5)
- **Deploy transaction:** [`0x4c720b0d…afe6`](https://explorer-studio.genlayer.com/tx/0x4c720b0d3e7b8387baa06236545a3670ee5884ca303ec0e88aac0da7e275afe6)
- **Source sha256:** `b4359cfe20a7baa0cc41dba3d1eed6ffc112e46893a4a0afc745a430825d4f75`
- **Transactions:** 19, from 8 different wallets
- **Generated:** 2026-10-18 23:15 UTC

## Wallets

Each wallet was made in memory for this run, and its key was never written
anywhere. Click an address to see every transaction it sent.

| Role | Address | Transactions sent |
|---|---|---|
| deployer | [`0xc1A3F8945111d391Adc83B46289397d20d07E1E2`](https://explorer-studio.genlayer.com/address/0xc1A3F8945111d391Adc83B46289397d20d07E1E2) | 1 |
| restaurant | [`0xacE9Bd86713208048dADD2f3d74E1aD25eE7e639`](https://explorer-studio.genlayer.com/address/0xacE9Bd86713208048dADD2f3d74E1aD25eE7e639) | 5 |
| ann | [`0x92E9d8d22d028E640bBEd2301E518A9ed45865E4`](https://explorer-studio.genlayer.com/address/0x92E9d8d22d028E640bBEd2301E518A9ed45865E4) | 2 |
| ben | [`0x565E4a03A3b840E1462a7F429Fc81866a129daeE`](https://explorer-studio.genlayer.com/address/0x565E4a03A3b840E1462a7F429Fc81866a129daeE) | 2 |
| cal | [`0x447e2F817C14e8182Ffb50C283D364C89E699E4c`](https://explorer-studio.genlayer.com/address/0x447e2F817C14e8182Ffb50C283D364C89E699E4c) | 2 |
| dev | [`0x06b175b5f5aC4530baA43D06b8C6f39a0ad8063D`](https://explorer-studio.genlayer.com/address/0x06b175b5f5aC4530baA43D06b8C6f39a0ad8063D) | 2 |
| eve | [`0x627a6c08Fd3910E2AaBB947cf36914cBaf049e55`](https://explorer-studio.genlayer.com/address/0x627a6c08Fd3910E2AaBB947cf36914cBaf049e55) | 1 |
| stranger | [`0xD01e7F5e86c47eE840e71cb15aC2D6F1C2bbE255`](https://explorer-studio.genlayer.com/address/0xD01e7F5e86c47eE840e71cb15aC2D6F1C2bbE255) | 4 |

## Transactions, in order

"refused" is a transaction the contract was meant to refuse: the committee
agreed on the refusal, and the sentence is the contract's own.

| # | Step | Sent by | Method | On chain | Outcome | Tx |
|---|---|---|---|---|---|---|
| 0 | deploy | deployer [`0xc1A3…E1E2`](https://explorer-studio.genlayer.com/address/0xc1A3F8945111d391Adc83B46289397d20d07E1E2) | `deploy` | FINALIZED · MAJORITY_AGREE | executed | [`0x4c720b0d…afe6`](https://explorer-studio.genlayer.com/tx/0x4c720b0d3e7b8387baa06236545a3670ee5884ca303ec0e88aac0da7e275afe6) |
| 1 | venue 0: Osteria Nove, a 0.05 GEN deposit | restaurant [`0xacE9…e639`](https://explorer-studio.genlayer.com/address/0xacE9Bd86713208048dADD2f3d74E1aD25eE7e639) | `register` | FINALIZED · MAJORITY_AGREE | executed | [`0xa7cd05bb…8834`](https://explorer-studio.genlayer.com/tx/0xa7cd05bb11f594c617814c80607487492eb9b136facb2145473cf2219b8a8834) |
| 2 | the restaurant books its own table | restaurant [`0xacE9…e639`](https://explorer-studio.genlayer.com/address/0xacE9Bd86713208048dADD2f3d74E1aD25eE7e639) | `book` | FINALIZED · MAJORITY_AGREE | refused: the restaurant cannot book its own table | [`0xf76a6440…67b7`](https://explorer-studio.genlayer.com/tx/0xf76a6440fdce27708a8c4a595faffcc9af4d05a2668128f4b2590972ca1667b7) |
| 3 | booking 0: Ann | ann [`0x92E9…65E4`](https://explorer-studio.genlayer.com/address/0x92E9d8d22d028E640bBEd2301E518A9ed45865E4) | `book` | FINALIZED · MAJORITY_AGREE | executed | [`0xe500d078…8bcc`](https://explorer-studio.genlayer.com/tx/0xe500d078a947d0a0f67ec159997aca249ed8ca4f136b832bb988a8619abc8bcc) |
| 4 | booking 1: Ben | ben [`0x565E…daeE`](https://explorer-studio.genlayer.com/address/0x565E4a03A3b840E1462a7F429Fc81866a129daeE) | `book` | FINALIZED · MAJORITY_AGREE | executed | [`0xdee2ad5c…4949`](https://explorer-studio.genlayer.com/tx/0xdee2ad5c065f99a41c9319ccd3bea9b1ba736484efb16605f908362c3e354949) |
| 5 | booking 2: Cal | cal [`0x447e…9E4c`](https://explorer-studio.genlayer.com/address/0x447e2F817C14e8182Ffb50C283D364C89E699E4c) | `book` | FINALIZED · MAJORITY_AGREE | executed | [`0xb2f1f979…6453`](https://explorer-studio.genlayer.com/tx/0xb2f1f97960f77a124bb2edaebf3653309bedac38a0120bc8d709680f3b526453) |
| 6 | booking 3: Dev | dev [`0x06b1…063D`](https://explorer-studio.genlayer.com/address/0x06b175b5f5aC4530baA43D06b8C6f39a0ad8063D) | `book` | FINALIZED · MAJORITY_AGREE | executed | [`0xb49f2c51…6e06`](https://explorer-studio.genlayer.com/tx/0xb49f2c511b727369b886721640c26fed66c593457cb81ba8cc86054ca2b96e06) |
| 7 | booking 4: Eve | eve [`0x627a…9e55`](https://explorer-studio.genlayer.com/address/0x627a6c08Fd3910E2AaBB947cf36914cBaf049e55) | `book` | FINALIZED · MAJORITY_AGREE | executed | [`0x376b6975…b895`](https://explorer-studio.genlayer.com/tx/0x376b69759bc9b2921388c72084150f3e455b966b423c1ef9a9643eaa1cbab895) |
| 8 | a booking paying the wrong deposit | stranger [`0xD01e…E255`](https://explorer-studio.genlayer.com/address/0xD01e7F5e86c47eE840e71cb15aC2D6F1C2bbE255) | `book` | FINALIZED · MAJORITY_AGREE | refused: pay the deposit exactly: 50000000000000000 wei, not 10000000000000000 | [`0x191d5f4c…e760`](https://explorer-studio.genlayer.com/tx/0x191d5f4c43af015036f4c96d86ce227415e52d2be5cb7e62d82fa05319f8e760) |
| 9 | Ann cancels in the free window | ann [`0x92E9…65E4`](https://explorer-studio.genlayer.com/address/0x92E9d8d22d028E640bBEd2301E518A9ed45865E4) | `cancel` | FINALIZED · MAJORITY_AGREE | executed | [`0xe054a315…03f4`](https://explorer-studio.genlayer.com/tx/0xe054a315a6f6e08df6bc40fbb55334eef0af3b4272eaef50ab01fd28a08b03f4) |
| 10 | a stranger cancels Ben's booking | stranger [`0xD01e…E255`](https://explorer-studio.genlayer.com/address/0xD01e7F5e86c47eE840e71cb15aC2D6F1C2bbE255) | `cancel` | FINALIZED · MAJORITY_AGREE | refused: only the guest may cancel | [`0x73625bcb…12ef`](https://explorer-studio.genlayer.com/tx/0x73625bcbb8b151761333b77329613e843e59a8246380f1717ad20d3a693912ef) |
| 11 | a guest seated during free cancellation | restaurant [`0xacE9…e639`](https://explorer-studio.genlayer.com/address/0xacE9Bd86713208048dADD2f3d74E1aD25eE7e639) | `seat` | FINALIZED · MAJORITY_AGREE | refused: a guest is seated from 2026-10-18T22:40:30Z, when free cancellation ends | [`0x92383191…c561`](https://explorer-studio.genlayer.com/tx/0x923831918a703ec51c430f6f75c12a15057356a4584e51fb2a15dacb7750c561) |
| 12 | Ben cancels late: a child with a fever | ben [`0x565E…daeE`](https://explorer-studio.genlayer.com/address/0x565E4a03A3b840E1462a7F429Fc81866a129daeE) | `cancel` | FINALIZED · MAJORITY_AGREE | executed | [`0x1423327b…79a6`](https://explorer-studio.genlayer.com/tx/0x1423327bc888b063a678a4004186171259b913f55b657c08dd73bbf0e34079a6) |
| 13 | Cal cancels late: a better offer | cal [`0x447e…9E4c`](https://explorer-studio.genlayer.com/address/0x447e2F817C14e8182Ffb50C283D364C89E699E4c) | `cancel` | FINALIZED · MAJORITY_AGREE | executed | [`0x9c29d973…4dc0`](https://explorer-studio.genlayer.com/tx/0x9c29d9735d5a935e7e5146a1374b664123715c77d9f2036cb816917a3d454dc0) |
| 14 | Dev cancels after the booking started | dev [`0x06b1…063D`](https://explorer-studio.genlayer.com/address/0x06b175b5f5aC4530baA43D06b8C6f39a0ad8063D) | `cancel` | FINALIZED · MAJORITY_AGREE | refused: the booking started at 2026-10-18T23:00:41Z; a cancellation after that is never judged | [`0x12c7b2cb…0f89`](https://explorer-studio.genlayer.com/tx/0x12c7b2cb7df62a1992d8fd85d6729f1aaf3f3c2da6461b7c47db8f4b4bfd0f89) |
| 15 | Eve is seated | restaurant [`0xacE9…e639`](https://explorer-studio.genlayer.com/address/0xacE9Bd86713208048dADD2f3d74E1aD25eE7e639) | `seat` | FINALIZED · MAJORITY_AGREE | executed | [`0x96fc961c…61b8`](https://explorer-studio.genlayer.com/tx/0x96fc961cd6a9ef9499615201527fe7486eb80e6da10f1c51443e0898e39e61b8) |
| 16 | a settlement during Dev's grace period | stranger [`0xD01e…E255`](https://explorer-studio.genlayer.com/address/0xD01e7F5e86c47eE840e71cb15aC2D6F1C2bbE255) | `settle` | FINALIZED · MAJORITY_AGREE | refused: the guest may cancel or be seated until 2026-10-18T23:10:41Z | [`0x59e6725e…5928`](https://explorer-studio.genlayer.com/tx/0x59e6725e54a31b014b6f0ca84c6acbaa7851b80ffe2519f6fc1b7e3f4f265928) |
| 17 | Dev seated after the grace period | restaurant [`0xacE9…e639`](https://explorer-studio.genlayer.com/address/0xacE9Bd86713208048dADD2f3d74E1aD25eE7e639) | `seat` | FINALIZED · MAJORITY_AGREE | refused: the grace period ended at 2026-10-18T23:10:41Z | [`0x775aae8d…5745`](https://explorer-studio.genlayer.com/tx/0x775aae8dee8107904f15ccd52f6b7eeb40f0e9ba6d7117a42f60ae21f4005745) |
| 18 | Dev's booking settled: a no-show | stranger [`0xD01e…E255`](https://explorer-studio.genlayer.com/address/0xD01e7F5e86c47eE840e71cb15aC2D6F1C2bbE255) | `settle` | FINALIZED · MAJORITY_AGREE | executed | [`0x2577f3e4…4b5e`](https://explorer-studio.genlayer.com/tx/0x2577f3e45fe65fdaba1fb6706b7c10d79df7b297b1d468c2f3eec3e02ef54b5e) |
