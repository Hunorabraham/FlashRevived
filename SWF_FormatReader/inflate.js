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
    this.last = false;
    this.window_width = 0;
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
      if(this.BITS(4) !== 8){//deflate encoding
        this.error_message = "unknown compression method";
        return "ERR";
      }
      this.CONSUMEBITS(4);
      this.window_width = this.BITS(4)+8;
      if(this.window_width > 15){
        this.error_message = "invalid window size: " + this.window_width;
        return "ERR";
      }
      this.mode = (this.hold & 0x200) !== 0 ? "DICTID" : "TYPE";
      this.CLEARACCUMULATOR();
      console.log(`Header read\n\tmethod: DEFLATE\n\twindow width: ${this.window_width}`);
      break;//HEAD
    case "DICTID":
      this.error_message = "use of external dict is not supported"
      return "ERR";
    case "TYPE":
      if(this.last){
        this.ALINGTOBYTE();
        this.mode = "CHECK";
        break;
      }
      this.GETBITS(3);
      this.last = this.BITS(1);
      this.CONSUMEBITS(1);
      //this might need a bit more elbow grease
      switch(this.BITS(2)){
        //stored
        case 0:
          this.mode = "STORED";
          break;
      }
      
      return "ERR";
      break;
    default:
      this.error_message = "Not implemented yet/unexpected mode: " + this.mode;
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
  CONSUMEBITS(n){
    this.hold >>= n;
    this.bits -= n;
  }
  ALIGNTOBYTE(){
    this.hold >>= this.bits & 7;
    this.bits -= this.bits & 7;
  }
  CLEARACCUMULATOR(){
    this.hold = 0;
    this.bits = 0;
  }
}
