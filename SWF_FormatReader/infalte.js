class ZLIB_DECODER{
  constructor(inflation_target, size_hint){
    this.data = new Uint8Array(inflation_target);
    this.mode = "HEAD";
    this.bits = 0;
    this.hold = 0;
    this.remaining = this.data.length;
    this.reading_position = 0;
    this.error_message = "";
    this.result = new Uint8Array(new ArrayBuffer(size_hint));
  }
  inflate(){
    while(true){
    switch(this.mode){
    case "HEAD":
      this.GETBITS(16);
      //slight bit magic for checksum, "!== 0" is needed to convert number to bool correctly (c-style)
      if(((this.BITS(8) << 8) + (this.hold >> 8)) % 31 !== 0){
        this.error_message = "incorrect header check";
        return "ERR";
      }
      this.mode = "TESTNEXT";
      break;
    default:
      this.error_messge = "Not implemented yet/unexpected mode: " + this.mode;
      return "ERR";
    }//switch
    }//while
  }
  BITS(n) {return this.hold & ((1 << n) - 1);}
  GETBITS(n) {
    while(this.bits < n){
      if(this.GETBYTE() !== "OK"){
        return "ERR";
      }
    }
    return "OK";
  }
  GETBYTE(){
    if(this.remaining <= 0){
      this.error_message = "data ended unexpectedly";
      return "ERR";
    }
    this.remaining--;
    this.hold += this.data[this.reading_position++] << this.bits;
    this.bits += 8;
    return "OK";
  }
}

