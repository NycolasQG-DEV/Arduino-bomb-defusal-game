import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SerialController} from '../src/serial';
test('conexão exige READY e ACK, aceita linhas fragmentadas e envia comandos na ordem',async()=>{
 let input!:ReadableStreamDefaultController<Uint8Array>;const commands:string[]=[];const encoder=new TextEncoder();
 const push=(line:string)=>input.enqueue(encoder.encode(line));
 const port={readable:new ReadableStream<Uint8Array>({start(controller){input=controller;}}),writable:new WritableStream<Uint8Array>({write(bytes){const line=new TextDecoder().decode(bytes);commands.push(line);if(line==='RESET\n')push('ACK|RESET\r\n');if(line==='START\n')push('ACK|START\n');}}),async open(options:{baudRate:number}){assert.equal(options.baudRate,115200);push('REA');push('DY|BOMB_V1\r\n');},async close(){}};
 Object.defineProperty(globalThis,'navigator',{value:{serial:{requestPort:async()=>port}},configurable:true});Object.defineProperty(globalThis,'window',{value:{isSecureContext:true},configurable:true});
 const controller=new SerialController();const steps:number[]=[];const keys:string[]=[];let lost=false;controller.onKey=key=>keys.push(key);controller.onLost=()=>{lost=true;};
 await controller.connect(step=>steps.push(step));assert.deepEqual(steps,[1,2,3,4]);assert.deepEqual(commands,['RESET\n']);await controller.start();
 push('KEY|A\nKEY|*\nKEY|INVALID\n');await controller.send('LIVES|2');await controller.send('BUZZ|ALERT');assert.deepEqual(keys,['A','*']);assert.deepEqual(commands,['RESET\n','START\n','LIVES|2\n','BUZZ|ALERT\n']);
 input.close();await new Promise(resolve=>setImmediate(resolve));assert.ok(lost);await controller.close();
});
test('cancelar o seletor não autoriza a conexão',async()=>{
 Object.defineProperty(globalThis,'navigator',{value:{serial:{requestPort:async()=>{throw new DOMException('cancelado','NotFoundError');}}},configurable:true});
 const controller=new SerialController();const steps:number[]=[];await assert.rejects(controller.connect(step=>steps.push(step)),{name:'NotFoundError'});assert.deepEqual(steps,[1]);await controller.close();
});
