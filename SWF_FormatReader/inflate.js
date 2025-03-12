/*
* See compliance at  Request for Comments: 1950-1951
*/
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
  static MAXBITS = 16;
  static createStringCode(code, len){
    let result = "";
    for(let i = 0n; i < len; i++){
      result = (((code >> i) & 1n) == 0n ? "0" : "1") + result;
    }
    return result;
  }
  static generateTree(lengths){
    //get count of lengths
    let bl_count = Array(ZLIB_DECODER.MAXBITS).fill(0n);
    lengths.forEach(len=>bl_count[len]++);
    //get smallest code values
    let code = 0n;
    let next_code = Array(ZLIB_DECODER.MAXBITS).fill(0n);
    for(let bits = 1n; bits <= ZLIB_DECODER.MAXBITS; bits++){
      code = (code + bl_count[bits-1n]) << 1n;
      next_code[bits] = code;
    }
    let flat_tree = [];
    for(let n = 0; n < lengths.length; n++){
      let len = lengths[n];
      if(len == 0) continue;
      flat_tree[n] = ZLIB_DECODER.createStringCode(next_code[len],len);
      next_code[len]++;
    }
    let tree = [{partial_code: ""}];
    let current_code = "";
    let current_place = 0;
    let placed_codes = 0;
    let total_codes = lengths.filter(len => len != 0).length;
    let iter = 0;
    let maxiter = 2000;
    while(placed_codes < total_codes){
      current_code = tree[current_place].partial_code;
      let match = flat_tree.find(code=>code===current_code);
      if(match == undefined){
        //no match
        //change current node to branch
        tree[current_place] = {code: false, left: null, right: null}; //partial code for debugging
        //push two children onto the tree
        tree[current_place].left = tree.length;
        tree.push({code: false, partial_code: current_code+"0"});
        tree[current_place].right = tree.length;
        tree.push({code: false, partial_code: current_code+"1"});
      }
      else{
        //change current node to code
        tree[current_place] = {code: true, value: flat_tree.indexOf(match)}; //partial code for debugging
        placed_codes++;
      }
      //step forward
      current_place++;
      if(iter++ >= maxiter) break;
    }
    return tree;
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
          let length = this.littleEndian16(this.hold);
          this.CLEARACCUMULATOR();
          //I don't care about the one complement
          this.GETBITS(16);
          this.CLEARACCUMULATOR();
          //write literal bytes
          this.writeChunk(this.data.slice(this.reading_position, length));
          //jump over the written bytes
          this.reading_position += length;
          //read next header
          block_part = "head";
          break;
        case "dynamic-huffman":
          //table info
          if(!this.GETBITS(14)) return false;
          let lit_length_count = this.BITS(5)+257;
          this.CONSUMEBITS(5);
          let distance_count = this.BITS(5)+1;
          this.CONSUMEBITS(5);
          let code_length_code_count = this.BITS(4)+4;
          this.CONSUMEBITS(4);
          
          //get lengths of length codes
          let length_lengths = Array(19).fill(0);
          //a little index magic for specific order
          let indicies = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
          for(let i = 0; i < code_length_code_count; i++){
            this.GETBITS(3);
            length_lengths[indicies[i]] = this.BITS(3);
            this.CONSUMEBITS(3);
          }
          console.log(code_length_code_count, length_lengths);
          
          //generate length tree
          let length_tree = ZLIB_DECODER.generateTree(length_lengths);
          //get lenths of literal/length alphabet
          let literal_lengths = []; //intentionally only named it literal
          let current_index = 0;
          for(let i = 0; i < lit_length_count; i++){
            //get next bit
            this.GETBITS(1);
            let step = this.BITS(1) == 0 ? "left" : "right";
            this.CONSUMEBITS(1);
            
            //move down in tree
            current_index = length_tree[current_index][step];
            //check if reached valid symbol
            if(!length_tree[current_index].code) continue;
            //do alphabet with value
            let symbol = length_tree[current_index].value;
            if(symbol<16){
              literal_lengths.push(symbol);
            }
            else if(symbol == 16){
              this.GETBITS(2);
              let repeat_count = this.BITS(2)+3;
              this.CONSUMEBITS(2);
              for(let i = 0; i < repeat_count; i++){
                literal_lengths.push(literal_lengths[literal_lengths.length-1]);
              }
            }
            else if(symbol == 17){
              this.GETBITS(3);
              let zeroes = this.BITS(3)+3;
              this.CONSUMEBITS(3);
              for(let i = 0; i < zeroes; i++){
                literal_lengths.push(0);
              }
            }
            else{
              this.GETBITS(7);
              let zeroes = this.BITS(7)+11;
              this.CONSUMEBITS(7);
              for(let i = 0; i < zeroes; i++){
                literal_lengths.push(0);
              }
            }
            //go back to head of tree
            current_index = 0;
          }//literal lengths for
          console.log(literal_lengths);
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
        this.error_message += "; asking for: " + n + "bits";
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
    if(this.bits + 8 > 32){
      this.error_message = "hold size exhausted, too many bits requested, current: " + this.bits;
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
