class AVM_2{
  constructor(){
    this.stack = 0;
  }
  execute_command(command){
    switch(command){
      case "aaa":
        console.log("aaa");
        break;
      default:
        return "unrecognised command: " + command;
    }
  }
}
class FLASH_PLAYER{
  constructor(data, renderer){
    this.data = data;
    this.renderer = renderer;
    this.VM = new AVM_2();
    this.character_dictionary = {};
    this.display_list = [];
    this.reading_position = 0n; //the index of the next unread byte in data
    this.hold = 0n; //the last read byte, only set if there are unused bits
    this.bits_remaining = 0n; //the number of unused bits in the last read byte
    this.error_message;
  }
  run(){
    console.log("starting execution, SWF Version: " + this.data[3]);
    this.reading_position = 8n;
    //read in rest of swf header
    
    this.TYPE_SIGNATURES["UI8"]();
    console.log(this.nextTag());
  }
  test(){
    this.renderer.draw_general_debug("fillRect", 10,10,100,100);
  }
  nextTag(){
    //header
    let tag = {};
    let shortHead = this.getBytes(2n);
    console.log(shortHead);
    //  tag code
    tag.code = shortHead >> 6n;
    tag.length = shortHead & 0x3fn;
    //  if the shortHead length code is 63, then it is a long head
    if(tag.length === 0x3fn) tag.length = this.getBytes(4n);
    return tag;
  }
  nextByte(){return this.data[this.reading_position++];}
  //can be made better
  getBits(n){
    let num = 0n;
    let consumed_bits = 0n;
    while(consumed_bits < n){
      if(this.bits_remaining == 0){
        this.hold = BigInt(this.nextByte());
        this.bits_remaining = 8;
      }
      let needed_bits = Math.Min(n-consumed_bits, this.bits_remaining);
      num += (this.hold >> (this.bits_remaining - needed_bits)) << consumed_bits;
      this.bits_remaining -= needed_bits;
      consumed_bits += needed_bits;
    }
    return num;
  }
  //only call this for byte aligned, little endian values
  getBytes(n){
    //hold and bits remaning are reset
    this.hold = 0n;
    this.bits_remaining = 0n;
    let num = 0n;
    for(let i = 0n; i < n; i++){
      num += BigInt(this.nextByte()) << (i*8n);
    }
    return num;
  }
  //dictionary of functions to load each type
  TYPE_SIGNATURES = {
    "UI8" : ()=>{return this.getBytes(1);},
    "UI16" : ()=>{return this.getBytes(2);},
    "UI32" : ()=>{return this.getBytes(4);},
    "UI64" : ()=>{return this.getBytes(8);},
    "SI8" : ()=>{return this.getBytes(1);},
    "SI16" : ()=>{return this.getBytes(2);},
    "SI32" : ()=>{return this.getBytes(4);},
    "SI64" : ()=>{return this.getBytes(8);},
    "RECT": ()=>{
      
    }
  }
  //recursive function to parse record data into a JS object
  getRecord(type){
    return this.TYPE_SIGNATURES["type"]();
  }
}
class HTML_CANVAS_RENDERER{
  constructor(target){
    this.can = target;
    this.ctx = target.getContext("2d");
  }
  /*
  *for debugging only please don't use
  */
  draw_general_debug(func_name, ...args){
    console.log("draw call: " + func_name + "\nargs:", ...args);
    this.ctx[func_name](...args);
  }
}
class TYPE_READER{
  static littleEndianInt(bytes){
    let num = 0n;
    for(let i = 0n; i < bytes.length; i++){
      num += BigInt(bytes[i]) << (i*8n);
    }
    return num;
  }
  static toHexString(number){
    if(number == 0n) return "0";
    let str = "";
    let chars = ['a','b','c','d','e','f'];
    while(number != 0n){
      let hex_digit = number & 15n;
      str = (hex_digit < 10n ? hex_digit : chars[hex_digit - 10n]) + str;
      number = number >> 4n;
    }
    return str;
  }
}
