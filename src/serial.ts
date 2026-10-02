type Reader = ReadableStreamDefaultReader<Uint8Array>;
interface Port { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array>; open(options:{baudRate:number}):Promise<void>; close():Promise<void> }
interface Serial { requestPort():Promise<Port> }
export const serialAvailable = () => 'serial' in navigator && window.isSecureContext;
export class SerialController {
 private port?:Port; private reader?:Reader; private buffer=''; private waiters=new Map<string,{resolve:()=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 private closing=false; private writes=Promise.resolve();
 onKey:(key:string)=>void=()=>{}; onLost:()=>void=()=>{};
 private receive(line:string){
  const waiter=this.waiters.get(line); if(waiter){clearTimeout(waiter.timer);this.waiters.delete(line);waiter.resolve();}
  if(/^KEY\|[0-9ABCD*#]$/.test(line))this.onKey(line.slice(4));
 }
 private wait(line:string,timeout=8000){return new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{this.waiters.delete(line);reject(new Error(`Sem resposta ${line}. Confira o firmware e a velocidade 115200.`));},timeout);this.waiters.set(line,{resolve,reject,timer});});}
 async connect(progress:(step:number)=>void){
  if(!serialAvailable())throw new Error('Use Chrome ou Edge no computador, em localhost ou HTTPS.');
  this.closing=false; progress(1);
  const port=await (navigator as Navigator & {serial:Serial}).serial.requestPort();await this.close();this.closing=false;this.port=port;progress(2);
  const ready=this.wait('READY|BOMB_V1');
  try{await port.open({baudRate:115200});void this.read();await ready;progress(3);await this.reset();progress(4);}
  catch(error){void ready.catch(()=>{});await this.close();throw error;}
 }
 async reset(){const ack=this.wait('ACK|RESET');try{await this.send('RESET');await ack;}catch(error){void ack.catch(()=>{});throw error;}}
 async start(){const ack=this.wait('ACK|START');try{await this.send('START');await ack;}catch(error){void ack.catch(()=>{});throw error;}}
 send(command:string){const operation=this.writes.then(async()=>{if(!this.port?.writable)throw new Error('Porta desconectada.');const writer=this.port.writable.getWriter();try{await writer.write(new TextEncoder().encode(command+'\n'));}finally{writer.releaseLock();}});this.writes=operation.catch(()=>{});return operation;}
 private async read(){const decoder=new TextDecoder();this.reader=this.port!.readable.getReader();try{while(true){const {value,done}=await this.reader.read();if(done)break;this.buffer+=decoder.decode(value,{stream:true});if(this.buffer.length>4096)throw new Error('Dados inválidos');let end;while((end=this.buffer.indexOf('\n'))>=0){this.receive(this.buffer.slice(0,end).trim());this.buffer=this.buffer.slice(end+1);}}}catch{}finally{this.reader.releaseLock();this.reader=undefined;if(!this.closing)this.onLost();}}
 async close(){this.closing=true;for(const waiter of this.waiters.values()){clearTimeout(waiter.timer);waiter.reject(new Error('Conexão encerrada.'));}this.waiters.clear();await this.reader?.cancel().catch(()=>{});await this.writes;await this.port?.close().catch(()=>{});this.port=undefined;this.buffer='';}
}
