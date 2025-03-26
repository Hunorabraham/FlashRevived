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
    this.result = [];
    this.last = false;
    this.window_width = 0;
    this.written = 0; // number of bytes written to result
    this.literal_tree = null;
    this.distance_tree = null;
    this.extracted_blocks = 0;
    this.log = "";
    this.lastParsed = null;
  }
  static MAXBITS = 16;
  static createStringCode(code, len){
    let result = "";
    for(let i = 0; i < len; i++){
      result = (((code >>> i) & 1) == 0 ? "0" : "1") + result;
    }
    return result;
  }
  static test(){
    let source = [
      0b00111011
    ];
    let tree = ZLIB_DECODER.generateTree([2,2,3,3,3,3]);
    this.selfLog(tree);
    let extracted_size = 3;
    let zd = new ZLIB_DECODER(source);
    let symbols = [];
    while(symbols.length < extracted_size){
      symbols.push(zd.getNextSymbol(tree));
    }
    this.selfLog(symbols);
  }
  static generateTree(lengths){
    //get count of lengths
    let bl_count = Array(ZLIB_DECODER.MAXBITS).fill(0);
    lengths.forEach(len=>bl_count[len]++);
    //get smallest code values
    let code = 0;
    let next_code = Array(ZLIB_DECODER.MAXBITS).fill(0);
    for(let bits = 1; bits <= ZLIB_DECODER.MAXBITS; bits++){
      code = (code + bl_count[bits-1]) << 1;
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
    }
    return tree;
  }
  addTestData(data) {this.testBytes = data;}
  inflate(){
      //copy first 8 bytes to output(swf header)
      this.data.slice(0,8).forEach((x)=>this.result.push(x));
      this.reading_position = 8;
      this.written = 8;
      if(this.testBytes != undefined) console.log("testing with data: ", this.testBytes);
      if(!this.GETBITS(16)) return false;
      //slight bit magic for checksum, "!== 0" is needed to convert number to bool correctly (c-style)
      if(((this.BITS(8) << 8) + (this.hold >>> 8)) % 31 !== 0){
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
      this.selfLog(`Header read\n\tmethod: DEFLATE\n\twindow width: ${2**this.window_width}`);
      let block_part = "head";
      major_while: while(true){
      switch(block_part){
        case "head":
          if(this.last){
            this.selfLog(`reached end of deflated blocks, total writes: ${this.written}, bytes read: ${this.reading_position}`)
            this.ALIGNTOBYTE();
            if(!this.checkAdler()){              
              this.error_message = "adler32 check failed, data may be corrupted";
              //silence this error because I'm too stupid for adler32
              //return false;
            }
            return true;
          }
          if(!this.GETBITS(3)) return false;
          if(this.BITS(1)===1) this.last = true;
          this.CONSUMEBITS(1);
          this.selfLog("block header");
          switch(this.BITS(2)){
            case 0:
              this.CONSUMEBITS(2);
              block_part = "non-compressed";
              break;
            case 1:
              block_part = "LEN";
              break;
            case 2:
              this.selfLog("dynamic huffman");
              this.CONSUMEBITS(2);
              block_part = "dynamic-huffman";
              break;
            case 3:
              this.error_message = "invalid block type";
              return false;
          }
          break;
        case "non-compressed":
          if(!this.GETBITS(16)) return false;
          let length = this.littleEndian16(this.hold);
          this.CLEARACCUMULATOR();
          //I don't care about the one complement
          if(!this.GETBITS(16)) return false;
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
          this.selfLog("literals: " + lit_length_count + "; distances: " + distance_count + "; code lengths: " + code_length_code_count);
          //get lengths of length codes
          let length_lengths = Array(19).fill(0);
          //a little index magic for specific order
          let indicies = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
          for(let i = 0; i < code_length_code_count; i++){
            if(!this.GETBITS(3)) return false;
            length_lengths[indicies[i]] = this.BITS(3);
            this.CONSUMEBITS(3);
          }
          
          //generate length tree
          let length_tree = ZLIB_DECODER.generateTree(length_lengths);
          //get lenths of literal/length alphabet
          let actual_lengths = []; //lengths for the literal_length-, and distance_trees
          while(actual_lengths.length < lit_length_count + distance_count){
            let symbol = this.getNextSymbol(length_tree);
            if(symbol<16){
              actual_lengths.push(symbol);
            }
            else if(symbol == 16){
              if(!this.GETBITS(2)) return false;
              let repeat_count = this.BITS(2)+3;
              this.CONSUMEBITS(2);
              for(let i = 0; i < repeat_count; i++){
                actual_lengths.push(actual_lengths[actual_lengths.length-1]);
              }
            }
            else if(symbol == 17){
              if(!this.GETBITS(3)) return false;
              let zeroes = this.BITS(3)+3;
              this.CONSUMEBITS(3);
              for(let i = 0; i < zeroes; i++){
                actual_lengths.push(0);
              }
            }
            else if(symbol == 18){
              if(!this.GETBITS(7)) return false;
              let zeroes = this.BITS(7)+11;
              this.CONSUMEBITS(7);
              for(let i = 0; i < zeroes; i++){
                actual_lengths.push(0);
              }
            }
            else{
              this.error_message = "unknown length coding symbol: " + symbol;
              return false;
            }
          }//literal lengths for
          if(actual_lengths.length !== lit_length_count + distance_count) console.error("extracted length mismatch reading lenghts: ", actual_lengths.length, lit_length_count + distance_count);
          //generate trees
          this.literal_tree = ZLIB_DECODER.generateTree(actual_lengths.slice(0,lit_length_count));
          this.distance_tree = ZLIB_DECODER.generateTree(actual_lengths.slice(lit_length_count));
          block_part = "decode";
          break;
        case "decode":
          while(true){
            //this.selfLog("decode while cycle");
            let symbol = this.getNextSymbol(this.literal_tree);
            //literal
            if(symbol < 256){
              this.before = this.lastParsed;
              this.lastParsed = "literal symbol: " + symbol;
              this.selfLog("literal symbol: " + symbol + "; coded byte: " + this.written);
              this.write(symbol);
              continue;
            }
            //end of block
            if(symbol === 256){
              block_part = "head";
              this.selfLog("done with block #"+this.extracted_blocks++);
              continue major_while;
            }
            //length distance pair
            let length = null;
            let distance = null;
            this.before = this.lastParsed;
            this.lastParsed = "length symbol: " + symbol;
            //down we go
            this.selfLog("length symbol: " + symbol);
            if(symbol < 265){
              length = symbol - 254;
            }
            else{
            //see no evil
            switch(symbol){
              case 265:
                if(!this.GETBITS(1)) return false;
                length = 11 + this.BITS(1);
                this.CONSUMEBITS(1);
                break;
              case 266:
                if(!this.GETBITS(1)) return false;
                length = 13 + this.BITS(1);
                this.CONSUMEBITS(1);
                break;
              case 267:
                if(!this.GETBITS(1)) return false;
                length = 15 + this.BITS(1);
                this.CONSUMEBITS(1);
                break;
              case 268:
                if(!this.GETBITS(1)) return false;
                length = 17 + this.BITS(1);
                this.CONSUMEBITS(1);
                break;
              case 269:
                if(!this.GETBITS(2)) return false;
                length = 19 + this.BITS(2);
                this.CONSUMEBITS(2);
                break;
              case 270:
                if(!this.GETBITS(2)) return false;
                length = 23 + this.BITS(2);
                this.CONSUMEBITS(2);
                break;
              case 271:
                if(!this.GETBITS(2)) return false;
                length = 27 + this.BITS(2);
                this.CONSUMEBITS(2);
                break;
              case 272:
                if(!this.GETBITS(2)) return false;
                length = 31 + this.BITS(2);
                this.CONSUMEBITS(2);
                break;
              case 273:
                if(!this.GETBITS(3)) return false;
                length = 35 + this.BITS(3);
                this.CONSUMEBITS(3);
                break;
              case 274:
                if(!this.GETBITS(3)) return false;
                length = 43 + this.BITS(3);
                this.CONSUMEBITS(3);
                break;
              case 275:
                if(!this.GETBITS(3)) return false;
                length = 51 + this.BITS(3);
                this.CONSUMEBITS(3);
                break;
              case 276:
                if(!this.GETBITS(3)) return false;
                length = 59 + this.BITS(3);
                this.CONSUMEBITS(3);
                break;
              case 277:
                if(!this.GETBITS(4)) return false;
                length = 67 + this.BITS(4);
                this.CONSUMEBITS(4);
                break;
              case 278:
                if(!this.GETBITS(4)) return false;
                length = 83 + this.BITS(4);
                this.CONSUMEBITS(4);
                break;
              case 279:
                if(!this.GETBITS(4)) return false;
                length = 99 + this.BITS(4);
                this.CONSUMEBITS(4);
                break;
              case 280:
                if(!this.GETBITS(4)) return false;
                length = 115 + this.BITS(4);
                this.CONSUMEBITS(4);
                break;
              case 281:
                if(!this.GETBITS(5)) return false;
                length = 131 + this.BITS(5);
                this.CONSUMEBITS(5);
                break;
              case 282:
                if(!this.GETBITS(5)) return false;
                length = 163 + this.BITS(5);
                this.CONSUMEBITS(5);
                break;
              case 283:
                if(!this.GETBITS(5)) return false;
                length = 195 + this.BITS(5);
                this.CONSUMEBITS(5);
                break;
              case 284:
                if(!this.GETBITS(5)) return false;
                length = 227 + this.BITS(5);
                this.CONSUMEBITS(5);
                break;
              case 285:
                length = 258;
                break;
              default:
                this.error_message = "Impossible code(should not appear in data): " + symbol;
                return false;
            }
            }
            this.selfLog("length: " + length);
            //get distance
            symbol = this.getNextSymbol(this.distance_tree);
            this.selfLog("distance symbol: " + symbol);
            if(symbol < 4){
              distance = symbol + 1;
            }
            else{
            //another one bites the dusst
            switch(symbol){
              case 4:
                if(!this.GETBITS(1)) return false;
                distance = 5 + this.BITS(1);
                this.CONSUMEBITS(1);
                break;
              case 5:
                if(!this.GETBITS(1)) return false;
                distance = 7 + this.BITS(1);
                this.CONSUMEBITS(1);
                break;
              case 6:
                if(!this.GETBITS(2)) return false;
                distance = 9 + this.BITS(2);
                this.CONSUMEBITS(2);
                break;
              case 7:
                if(!this.GETBITS(2)) return false;
                distance = 13 + this.BITS(2);
                this.CONSUMEBITS(2);
                break;
              case 8:
                if(!this.GETBITS(3)) return false;
                distance = 17 + this.BITS(3);
                this.CONSUMEBITS(3);
                break;
              case 9:
                if(!this.GETBITS(3)) return false;
                distance = 25 + this.BITS(3);
                this.CONSUMEBITS(3);
                break;
              case 10:
                if(!this.GETBITS(4)) return false;
                distance = 33 + this.BITS(4);
                this.CONSUMEBITS(4);
                break;
              case 11:
                if(!this.GETBITS(4)) return false;
                distance = 49 + this.BITS(4);
                this.CONSUMEBITS(4);
                break;
              case 12:
                if(!this.GETBITS(5)) return false;
                distance = 65 + this.BITS(5);
                this.CONSUMEBITS(5);
                break;
              case 13:
                if(!this.GETBITS(5)) return false;
                distance = 97 + this.BITS(5);
                this.CONSUMEBITS(5);
                break;
              case 14:
                if(!this.GETBITS(6)) return false;
                distance = 129 + this.BITS(6);
                this.CONSUMEBITS(6);
                break;
              case 15:
                if(!this.GETBITS(6)) return false;
                distance = 193 + this.BITS(6);
                this.CONSUMEBITS(6);
                break;
              case 16:
                if(!this.GETBITS(7)) return false;
                distance = 257 + this.BITS(7);
                this.CONSUMEBITS(7);
                break;
              case 17:
                if(!this.GETBITS(7)) return false;
                distance = 385 + this.BITS(7);
                this.CONSUMEBITS(7);
                break;
              case 18:
                if(!this.GETBITS(8)) return false;
                distance = 513 + this.BITS(8);
                this.CONSUMEBITS(8);
                break;
              case 19:
                if(!this.GETBITS(8)) return false;
                distance = 769 + this.BITS(8);
                this.CONSUMEBITS(8);
                break;
              case 20:
                if(!this.GETBITS(9)) return false;
                distance = 1025 + this.BITS(9);
                this.CONSUMEBITS(9);
                break;
              case 21:
                if(!this.GETBITS(9)) return false;
                distance = 1537 + this.BITS(9);
                this.CONSUMEBITS(9);
                break;
              case 22:
                if(!this.GETBITS(10)) return false;
                distance = 2049 + this.BITS(10);
                this.CONSUMEBITS(10);
                break;
              case 23:
                if(!this.GETBITS(10)) return false;
                distance = 3073 + this.BITS(10);
                this.CONSUMEBITS(10);
                break;
              case 24:
                if(!this.GETBITS(11)) return false;
                distance = 4097 + this.BITS(11);
                this.CONSUMEBITS(11);
                break;
              case 25:
                if(!this.GETBITS(11)) return false;
                distance = 6145 + this.BITS(11);
                this.CONSUMEBITS(11);
                break;
              case 26:
                if(!this.GETBITS(12)) return false;
                distance = 8193 + this.BITS(12);
                this.CONSUMEBITS(12);
                break;
              case 27:
                if(!this.GETBITS(12)) return false;
                distance = 12289 + this.BITS(12);
                this.CONSUMEBITS(12);
                break;
              case 28:
                if(!this.GETBITS(13)) return false;
                distance = 16385 + this.BITS(13);
                this.CONSUMEBITS(13);
                break;
              case 29:
                if(!this.GETBITS(13)) return false;
                distance = 24577 + this.BITS(13);
                this.CONSUMEBITS(13);
                break;
              default:
                this.error_message = "Impossible code(should not appear in data): " + symbol;
                return false;
            }
            }
            this.selfLog("distance: " + distance);
            let span_log = "coded bytes: " + this.written;
            //now execute the length distance extraction
            
            this.lastParsed += "\ndistance symbol: " + symbol + "\nvalues: l - " + length + "; d - " + distance;
            for(let i = 0; i < length; i++){
              this.write(this.result[this.written-distance]);
              this.cycle = i;
            }
            this.selfLog(span_log + " through "+ (this.written-1));
          }//while
          block_part = "how did we get here???";
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
    this.hold >>>= n;
    this.bits -= n;
  }
  ALIGNTOBYTE(){
    this.hold >>>= this.bits & 7;
    this.bits -= this.bits & 7;
  }
  CLEARACCUMULATOR(){
    this.hold = 0;
    this.bits = 0;
  }
  littleEndian16(bytes){
    return ((bytes & 0xff) << 8) + ((bytes & 0xff00) >>> 8);
  }
  write(one_byte){
    if(this.testBytes != undefined){
        if(this.testBytes[this.written] != one_byte){
        console.log("incorrect byte: " + one_byte + ", should be: " + this.testBytes[this.written]);
        console.log("writing byte " + this.written);
        console.log("last parsed symbol/pair:\n" + this.lastParsed);
        console.log("one before: " + this.before);
        console.log("at: " + this.reading_position + " + " + this.bits);
        console.log("in: " + this.cycle);
        console.log("block #"+this.extracted_blocks)
        console.log(this.log);
        debugger;
      }
    }
    this.result[this.written++] = one_byte;
  }
  writeChunk(array){
    for(one_byte of array){
      this.result[this.written++] = one_byte;
    }
  }
  getNextSymbol(tree){
    let step = null;
    let current_index = 0;
    let code = "";
    while(!tree[current_index].code){
      if(!this.GETBITS(1)) return false;
      let step = this.BITS(1) == 0 ? "left" : "right";
      code += this.BITS(1);
      this.CONSUMEBITS(1);
      current_index = tree[current_index][step];
    }
    this.selfLog("code: " + code);
    return tree[current_index].value;
  }
  checkAdler(){
    let s1 = 1;
    let s2 = 0;
    for(let i of this.result.slice(8)){
      s1 = (s1 + i) % 65521;
      s2 = (s2 + s1) % 65521;
    }
    if(!this.GETBITS(32)) return false;
    let s1_check = this.BITS(16);
    this.CONSUMEBITS(16);
    let s2_check = this.BITS(16);
    this.CONSUMEBITS(16);
    if(s1_check !== s1 || s2_check !== s2){
      console.log(`It's wrong, but it's because of MY skill issue\ns1: ${s1} check ${s1_check}\ns2: ${s2} check ${s2_check}`);
      return false;
    }
    return true;
  }
  selfLog(string){
    this.log += "\n" + string;
  }
}
