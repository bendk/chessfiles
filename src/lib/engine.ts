import Stockfish, { StockfishClient } from '@lichess-org/stockfish-web/sf171-79';
import stockfishUrl from '@lichess-org/stockfish-web/sf171-79?url';
import stockfishWasmUrl from '@lichess-org/stockfish-web/sf171-79.wasm?url'

// - Downloaded from https://tests.stockfishchess.org/api/nn/nn-1c0000000000.nnue
// - Got the link from the README https://github.com/lichess-org/stockfish-web
// - Uploaded to assets.chessfiles.app, which is a Cloudflare R2 bucket
const nnueUrl = 'https://assets.chessfiles.app/nn-1c0000000000.nnue'

export function startEngine() {
  // Patch Stockfish to work with vite
  Stockfish({
    locateFile: (filename: string) => {
      console.log("locateFile", filename);
      if (filename == "sf171-79.wasm") {
        return new URL(stockfishWasmUrl, window.location.href)
      } else {
        throw Error(`Stockfish locateFile - unknown filename: ${filename}`)
      }
    },
    mainScriptUrlOrBlob: stockfishUrl,
  }).then((sf: StockfishClient) => {
      fetch(nnueUrl).then((resp) => {
        resp.bytes().then((buf) => {
          sf.setNnueBuffer(buf);
          sf.listen = (data) => {
            console.log("stockfish:", data);
          }
          sf.onError = (error) => {
            console.log("stockfish error:", error);
          }
          sf.uci("position startpos");
          sf.uci("go depth 12");
        });
      });
    });
}
