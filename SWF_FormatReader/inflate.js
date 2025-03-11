class ZLIB_DECODER{
  constructor(inflation_target, size_hint){
    this.data = new Uint8Array(inflation_target);
    this.bits = 0;
    this.hold = 0;
    this.reading_position = 0;
    this.error_message = "";
    this.result = new Uint8Array(new ArrayBuffer(size_hint));
    this.last = false;
    this.window_width = 0;
    this.written = 0; // number of bytes written to result
    this.current_tree = {};
  }
  inflate(){
      this.GETBITS(16);
      //slight bit magic for checksum, "!== 0" is needed to convert number to bool correctly (c-style)
      if(((this.BITS(8) << 8) + (this.hold >> 8)) % 31 !== 0){
        this.error_message = "incorrect header check";
        return false;
      }
      if(this.BITS(4) !== 8){//deflate encoding
        this.error_message = "unknown compression method";
        return false;
      }
      this.CONSUMEBITS(4);
      this.window_width = this.BITS(4)+8;
      if(this.window_width > 15){
        this.error_message = "invalid window size: " + this.window_width;
        return false;
      }
      if((this.hold & 0x200) !== 0){
        this.error_message = "use of external dict is not supported";
        return false;
      }
      this.CLEARACCUMULATOR();
      console.log(`Header read\n\tmethod: DEFLATE\n\twindow width: ${this.window_width}`);
      let block_part = "head";
      while(true){
      switch(block_part){
        case "head":
          if(this.last){
            this.ALIGNTOBYTE();
            this.Check();
          }
          this.GETBITS(3);
          if(this.BITS(1)===1) this.last = true;
          this.CONSUMEBITS(1);
          switch(this.BITS(2)){
            case 0:
              this.CLEARACCUMULATOR();
              block_part = "non-compressed";
              break;
            case 1:
              block_part = "LEN";
              break;
            case 2:
              this.CONSUMEBITS(2);
              block_part = "dynamic-huffman";
              break;
            case 3:
              this.error_message = "invalid block type";
              return false;
          }
          break;
        case "non-compressed":
          this.GETBITS(16);
          let lenght = this.littleEndian16(this.hold);
          this.CLEARACCUMULATOR();
          //I don't care about the one complement
          this.GETBITS(16);
          this.CLEARACCUMULATOR();
          //write literal bytes
          this.writeChunk(this.data.slice(this.reading_position, length));
          //jump over the written bytes
          this.reading_position += lenght;
          //read next header
          block_part = "head";
          break;
        case "dynamic-huffman":
          //table info
          this.GETBITS(14);
          let lit_length_count = this.BITS(5)+257;
          this.CONSUMEBITS(5);
          let distance_count = this.BITS(5)+1;
          this.CONSUMEBITS(5);
          let code_lenght_code_count = this.BITS(4)+4;
          this.CONSUMEBITS(4);
          //get lengths of length codes
          let lenght_lengths = Array(19).fill(0);
          console.log(lenght_lengths);
          //a little more magic
          let indicies = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
          //we already hace 2 bits of the first
          this.GETBITS(1);
          lenght_lengths[indicies[0]] = BITS(3);
          this.CONSUMEBITS(3);
          for(let i = 1; i < code_lenght_code_count; i++){
            this.GETBITS(3);
            lenght_lengths[i] = this.BITS(3);
            this.CONSUMEBITS(3);
          }
          
          //generate length tree
          let length_tree = {};
          
          
          
          block_part = "intentional error";
          break;
        default:
          this.error_message = "unexpected/not implemented block part: " + block_part;
          return false;
      }//Switch
      }//while
  }
  BITS(n) {return this.hold & ((1 << n) - 1);}
  GETBITS(n) {
    while(this.bits < n){
      if(!this.GETBYTE()){
        return false;
      }
    }
    return true;
  }
  GETBYTE(){
    if(this.reading_position >= this.data.length){
      this.error_message = "data ended unexpectedly";
      return false;
    }
    this.hold += this.data[this.reading_position++] << this.bits;
    this.bits += 8;
    return true;
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
  littleEndian16(bytes){
    return ((bytes & 0xff) << 8) + ((bytes & 0xff00) >> 8);
  }
  write(one_byte){
    this.result[this.written++] = one_byte;
  }
  writeChunk(array){
    for(one_byte of array){
      this.result[this.written++] = one_byte;
    }
  }
}
