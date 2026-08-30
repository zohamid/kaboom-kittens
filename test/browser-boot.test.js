'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const SOURCE_FILES=['art.js','game-engine.js','index.js','online.js'];

function fakeElement(){
  return {
    classList:{add(){},remove(){},toggle(){}},
    dataset:{},
    style:{},
    appendChild(){},
    focus(){},
    insertAdjacentHTML(){},
    innerHTML:'',
    textContent:'',
    value:'',
  };
}

test('browser sources initialize in document load order',()=>{
  const elements=new Map();
  const elementFor=selector=>{
    if(!elements.has(selector))elements.set(selector,fakeElement());
    return elements.get(selector);
  };
  const storage=new Map();
  const document={
    addEventListener(){},
    createElement:fakeElement,
    querySelector:elementFor,
    querySelectorAll(){return [];},
  };
  const browserGlobal={
    URL,
    URLSearchParams,
    addEventListener(){},
    clearInterval,
    clearTimeout,
    console,
    document,
    EventSource:function EventSource(){},
    fetch:async()=>({ok:true,json:async()=>null}),
    location:{href:'http://localhost:8000/',search:''},
    localStorage:{
      getItem:key=>storage.get(key)??null,
      setItem:(key,value)=>storage.set(key,String(value)),
    },
    navigator:{},
    setInterval,
    setTimeout,
    innerHeight:800,
    innerWidth:1280,
  };
  browserGlobal.window=browserGlobal;
  const context=vm.createContext(browserGlobal);

  for(const file of SOURCE_FILES){
    const filename=path.join(__dirname,'..','src',file);
    vm.runInContext(fs.readFileSync(filename,'utf8'),context,{filename});
  }

  assert.equal(typeof elementFor('#btnBots').onclick,'function');
  assert.equal(typeof elementFor('#btnOnline').onclick,'function');
  assert.match(elementFor('#heroArt').innerHTML,/^<svg/);
});
