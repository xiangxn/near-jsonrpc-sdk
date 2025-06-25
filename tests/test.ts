
function main() {
  const code = `export type JsonRpcRequest_for_block = {
      id: string;
      jsonrpc: string;
      /**
       * @enum block
       */
      method: "block";
      params: RpcBlockRequest;
    };`;
  const reg = /export type JsonRpcRequest_for\w*\s*=\s*{[^}]*};/gs
  console.log(reg.test(code))
  const ma = (code.match(reg) || []).length > 0
  console.log(ma)
}
main()