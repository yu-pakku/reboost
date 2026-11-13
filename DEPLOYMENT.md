# ReBoost：Vercel Hobbyデプロイ手順

この文書は公開準備です。ログイン・GitHubへのpush・Vercel公開は実行していません。実行する場合は利用者が承認し、所有アカウントで操作してください。M6のPush・Cron・クラウド保存は含みません。

## 構成

- Next.js App Router、Node.js 24系で検証。VercelのFramework PresetはNext.js、Root Directoryはこのプロジェクトのルート。
- Install Command: `npm ci`、Build Command: `npm run build`、Output DirectoryはNext.jsの既定（.next）。vercel.jsonにも設定しています。
- Webpackビルドを維持しています。M3時点でTurbopackの内部ポート作成が実行環境に拒否されたためで、PWA化に変更は不要です。
- ビルド後に `scripts/build-pwa.mjs` がpublic/sw.jsとpublic/pwa-assets.jsonを生成します。両ファイルはGit管理対象外ですが、Vercelのビルドで生成・配信されます。`next build`だけを手動指定せず、必ず`npm run build`を使用してください。
- 環境変数、APIキー、サーバーDB、認証、Cronは不要です。そのため.env.exampleは作成していません。秘密情報は追加しないでください。
- アイコンは利用者が提供した青い脳・チェックマーク・循環矢印の画像です。原本は `public/icons/source.png` に保持し、`npm run icons` で各サイズを再生成できます。黒い外側余白のみ白に整え、通常アイコンは外側余白を6%ずつトリミング、Android用maskableには安全余白を設けています。インストール済みPWAのアイコン更新時期はOSに依存するため、実機でも確認してください。

## 公開前のローカル確認

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

自動ブラウザ検証を実行できる環境では、次も実施してください。Chromiumを起動できない制限付き環境では失敗を成功扱いにせず記録します。

```sh
npx playwright install chromium
npm run test:e2e
```

開発サーバーではSWを登録しません。PWA確認は本番ビルドの`npm start`とlocalhost、またはHTTPS上で行ってください。

## GitHub連携で公開する

1. 公開するコードと秘密情報の有無を確認し、GitHubへ送信することを承認してください。このフォルダは開始時点ではGitリポジトリではありません。必要なら利用者がGit初期化・コミット・リモート登録・pushを行ってください。
2. Vercelへ所有アカウントでログインし、個人利用のHobbyプロジェクトでAdd New → Project → Import Git Repositoryから該当リポジトリを選択します。
3. GitHub Appの接続・リポジトリアクセス付与は利用者が対象を確認して行います。不要なリポジトリ全体への権限は付与しないでください。
4. Root Directory、Next.js、Node.js 24系、上記Install/Build Commandを確認。環境変数は空のままで構いません。
5. 設定を確認して利用者がDeployを実行し、本番のHTTPS URLを控えます。
6. 安定した本番ドメインを使い続けてください。Preview URLと本番URL・独自ドメイン間で端末内データは自動共有されません。

参考：[VercelのNext.js対応](https://vercel.com/docs/frameworks/full-stack/nextjs)、[Git連携](https://vercel.com/docs/git)。Hobbyの利用条件・ビルド上限等は公開時の契約画面と公式資料で確認してください。

## 本番URLでの検証

- `/manifest.webmanifest`が200で、name/short_nameがReBoost、displayがstandalone、start_url/scopeが`/`であること。
- `/icons/icon-192.png`・`/icons/icon-512.png`・`/icons/maskable-512.png`・`/apple-touch-icon.png`が画像として配信されること。Apple touch iconは180px。
- `/sw.js`がJavaScriptで配信され、Cache-Controlがno-storeを含み、Service-Worker-Allowedが`/`であること。
- 初回に本番URLをオンラインで開くこと。開発者ツールでService Workerの有効化を確認し、登録失敗やキャッシュ制限があればエラー表示を確認すること。
- 知識を登録し、リロード・詳細・編集・通常復習・最終テスト・統計・JSON出力と復元を確認すること。
- ブラウザのNetworkをOfflineに切り替え、ホーム・一覧・登録を再読込。オンラインで未訪問の知識詳細・編集・最終テストも専用シェルから開けること。
- オフラインで登録・編集・学習・JSON出力/復元を行い、再読み込みとオンライン復帰後も知識・進捗・履歴が残ること。
- 2回目のデプロイ時、新しい版の案内が出ても入力が消えず、「保存後に更新する」の操作で更新され、IndexedDBとJSON内容が維持されること。
- 320px・390px、縦横、safe-area、実機キーボード、スクロールして保存ボタンへ到達できること。

Preview Deploymentの認証保護が有効だと、SWの認証情報を伴わないプリキャッシュが失敗する場合があります。保護されたログインHTMLはキャッシュしない設計です。公開範囲を勝手に変更せず、本番の公開ページで確認してください。

## iPhoneでの追加と保存領域

Safariで本番HTTPS URLを開き、共有→ホーム画面に追加→ReBoostを起動し、standalone表示、アイコン、safe-areaを確認してください。可能なOSで「Webアプリとして開く」等の選択肢が表示された場合はその設定も確認します。

データは端末内保存で自動同期されません。スキーム・ホスト・ポートが変わると別オリジンです。localhost、127.0.0.1、Preview URL、本番ドメイン、独自ドメインはそれぞれ別の保存先になります。また、ブラウザ・プロファイル・プライベートモード・ホーム画面起動等の保存領域の共有を一律に仮定しないでください。追加前・URL変更前にJSONを出力し、新しい起動先で件数を確認、表示されなければJSONから復元してください。

Safariの容量制限・ストレージ整理・ブラウザデータ消去・PWA削除等による消失は、アプリのキャッシュ更新とは別です。バックアップは端末のファイル等へ保管してください。SW更新処理はIndexedDBを削除しません。[WebKitの保存ポリシー](https://webkit.org/blog/14403/updates-to-storage-policy/)も参照してください。

iOSの表示領域やファイル保存、オフライン再起動、キーボードの挙動は実機で確認が必要です。インストール可能であることは、アプリを閉じた状態での通知受信を意味しません。

## キャッシュと更新

公開HTML7画面、同一ビルドのJS/CSS/フォント、Manifestとアイコンを事前保存します。API、認証、RSC、動的な知識HTML・個人データはキャッシュしません。知識はIndexedDBだけに保存されます。

新しい版は準備完了後に待機し、利用者の操作で有効化します。現行と直前の2キャッシュだけを残し、他アプリのキャッシュは削除しません。新規HTMLを旧版のキャッシュへ混ぜず、オフライン時は整合した保存済みビルドを使います。複数タブがある場合は、各タブの入力を保存した後に再読み込みしてください。数世代前のタブは古い資産が残らない場合があります。

初回オンライン読込・オフライン準備完了前、キャッシュの消去後、ストレージ整理後の初回オフライン起動は保証できません。オンラインで準備し直してください。ロールバックはVercel側の公開版を戻した後、アプリの更新案内に従います。復旧のために利用者のIndexedDBを消去しないでください。
