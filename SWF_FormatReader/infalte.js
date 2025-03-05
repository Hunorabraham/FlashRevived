

class ZLIB_DECODER{
  constructor(inflation_target){
    this.data = new Uint8Array(inflation_target);
    this.mode = "HEAD";
    this.bits = 0;
    this.hold = 0;
    this.remaining = this.data.length;
    this.reading_position = 0;
  }
  getInflated(){
    while(true){
    switch(this.mode){
    case "HEAD":
      this.GETBITS(16);
      //slight bit magic for checksum, "!== 0" is needed to convert number to bool correctly (c-style)
      if((this.BITS(8) << 8) + (this.hold >> 8) % 31 !== 0){
        throw("incorrect header check");
      }
      break;
    default:
      console.error("Not implemented yet");
      return this;
    }//switch
    }//while
  }
  private BITS(n) {return this.hold & ((1 << n) - 1);}
  private GETBITS(n) {
    while(this.bits < n){
      this.GETBYTE();
    }
  }
  private GETBYTE(){
    if(this.remaining <= 0){
      throw("data eneded unexpectedly");
    }
    this.remaining--;
    this.hold += this.data[this.reading_position++] << this.bits;
    this.bits += 8;
    return "OK";
  }
}
