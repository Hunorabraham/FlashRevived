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
    this.tag_stream = [];
  }
  run(){
    console.log("starting execution, SWF Version: " + this.data[3]);
    this.reading_position = 8n;
    //read in rest of swf header
    this.frame_size = this.getRecord("RECT");
    this.frame_rate = this.getRecord("FIXED8");
    this.frame_count = this.getRecord("UI16");
    this.renderer.initialise(Number(this.frame_size.width), Number(this.frame_size.height));
    let tag;
    do{
      tag = this.nextTag();
      this.tag_stream.push(tag);
    } while(tag.type != "EndTag");
    console.log(this);
  }
  test(){
    this.renderer.draw_general_debug("fillRect", 10,10,100,100);
  }
  byteAlign(){this.hold = 0n; this.bits_remaining = 0n;}
  //array onject containing tag names, clumsy creation because I define them as I go, <- clean up later
  static TAG_TYPES = Object.assign(Array.prototype,{
    0: "EndTag",
    1 : "ShowFrame",
    2 : "DefineShape",
    9 : "SetBackgroundColor",
    14 : "DefineSound",
    24 : "Protect",
    56 : "ExportAssets",
    69 : "FileAttributes",
    253 : "What1",
    255 : "What2",
  });
  TAG_SIGNATURES = {
    FileAttributes: (size)=>{
      if(this.getBits(1n) !== 0n) throw("non zero reserved!");
      let data_object = {};
      data_object.UseDirectBlit = this.getBits(1n);
      data_object.UseGPU = this.getBits(1n);
      data_object.HasMetadata = this.getBits(1n);
      data_object.ActionScript3 = this.getBits(1n);
      if(this.getBits(2n) !== 0n) throw("non zero reserved!");
      data_object.UseNetwork = this.getBits(1n);
      if(this.getBits(24n) !== 0n) throw("non zero reserved!");
      return data_object;
    },
    SetBackgroundColor: (size)=>{
      return {BackGroundColor: this.getRecord("RGB")};
    },
    ShowFrame:()=>{return {};},
    EndTag : ()=>{return {};},
    What1 : (size)=>{this.reading_position += size; return {};},
    What2 : (size)=>{this.reading_position += size; return {};},
    ExportAssets : (size)=>{this.reading_position += size; return {};},
    Protect : (size)=>{
      if(size == 0n) return{};
      this.reading_position += size;
      return {MD5: this.data.slice(Number(this.reading_position-size),Number(this.reading_position))};
    },
    DefineSound : (size)=>{
      return{
        SoundId: this.getRecord("UI16"),
        SoundFormat: this.getRecord("UB", 4n),
        SoundRate: this.getRecord("UB", 2n),
        SoundSize: this.getRecord("UB", 1n),
        SoundType: this.getRecord("UB",1n) == 0n ? "Mono" : "Stereo",
        SoundSampleCount: this.getRecord("UI32"),
        SoundData: this.getSlice(size-7n),
      }
    },
    DefineShape: (size)=>{
      return{
        ShapeId: this.getRecord("UI16"),
        ShapeBounds: this.getRecord("RECT"),
        Shapes: this.getRecord("SHAPEWITHSTYLE"),
      }
    },
  };
  nextTag(){
    //header
    let tag = {};
    let shortHead = this.getBytes(2n);
    //  tag code
    tag.type = FLASH_PLAYER.TAG_TYPES[shortHead >> 6n];
    tag.length = shortHead & 0x3fn;
    //  if the shortHead length code is 63, then it is a long head
    if(tag.length === 0x3fn) tag.length = this.getBytes(4n);
    //data
    if(tag.type == undefined) {
      /*
      this.reading_position += tag.length;
      tag.type = shortHead >> 6n;
      return tag;
      */
      console.log(this.tag_stream);
      throw("unimplemented tag type: " + Number(shortHead >> 6n));
    }
    let data = this.TAG_SIGNATURES[tag.type](tag.length);
    Object.keys(data).forEach(key=>tag[key] = data[key]);
    return tag;
  }
  getSlice(n){
    this.reading_position += n;
    return this.data.slice(Number(this.reading_position-n), Number(this.reading_position));
  }
  //byte aligned
  nextByte(){
    this.byteAlign();
    if(this.data.length <= this.reading_position){
      throw("Unexpected input end!");
    }
    return this.data[this.reading_position++];
  }
  getHeldBits(n){
    if(this.bits_remaining < n) throw("requested too many bits: " + n);
    this.bits_remaining -= n;
    return (this.hold >> (this.bits_remaining)) & ((1n << n) - 1n);
  }
  advanceHold(){
    this.hold = BigInt(this.nextByte());
    this.bits_remaining = 8n;
  }
  getBits(n){
    let num = 0n;
    let consumed_bits = 0n;
    if(this.bits_remaining >= n){
      num = this.getHeldBits(n);
      return num;
    }
    consumed_bits = this.bits_remaining;
    num = this.getHeldBits(this.bits_remaining);
    while((n - consumed_bits) >= 8n){
      num <<= 8n;
      num += BigInt(this.nextByte());
      consumed_bits += 8n;
    }
    //for safety
    if(consumed_bits > n){ throw("somehow read too many bits"); }
    if(consumed_bits < n){
      this.advanceHold();
      num <<= n-consumed_bits;
      num += this.getHeldBits(n-consumed_bits);
    }
    return num;
  }
  //only call this for byte aligned, little endian values
  getBytes(n){
    //hold and bits remaning are reset
    this.byteAlign();
    let num = 0n;
    for(let i = 0n; i < n; i++){
      num += BigInt(this.nextByte()) << (i*8n);
    }
    return num;
  }
  //dictionary of functions to load each type
  TYPE_SIGNATURES = {
    SB: (n)=>{
      let small = this.getBits(n);
      if((small & (1n << (n-1))) == 1){
        small |= (-1n << n);
      }
      return small;
    }
    UB: (n)=>{return this.getBits(n);},
    UI8: ()=>{return this.getBytes(1);},
    UI16: ()=>{return this.getBytes(2);},
    UI32: ()=>{return this.getBytes(4);},
    UI64: ()=>{return this.getBytes(8);},
    SI8: ()=>{return this.getBytes(1);},
    SI16: ()=>{return this.getBytes(2);},
    SI32: ()=>{return this.getBytes(4);},
    SI64: ()=>{return this.getBytes(8);},
    FIXED8: ()=>{return this.nextByte()/256 + this.nextByte();},
    RECT: ()=>{
      this.byteAlign();
      let len = this.getBits(5n);
      let Xmin = this.getBits(len);
      let Xmax = this.getBits(len);
      let Ymin = this.getBits(len);
      let Ymax = this.getBits(len);
      return {
        Xmin: Xmin, 
        Xmax: Xmax, 
        Ymin: Ymin, 
        Ymax: Ymax,
        //JS like properties
        left: Xmin,
        right: Ymin,
        width: (Xmax-Xmin)/20n,
        height: (Ymax-Ymin)/20n,
      };
    },
    RGB: ()=>{
      return {
        Red: BigInt(this.nextByte()),
        Green: BigInt(this.nextByte()),
        Blue: BigInt(this.nextByte()),
      }
    },
    RGBA: ()=>{
      return {
        Red: BigInt(this.nextByte()),
        Green: BigInt(this.nextByte()),
        Blue: BigInt(this.nextByte()),
        Alpha: BigInt(this.nextByte()),
      }
    },
    SHAPEWITHSTYLE:()=>{
      return {
        FillStyles: this.getRecord("FILLSTYLEARRAY"),
        LineStyles: this.getRecord("LINESTYLEARRAY"),
        NumFillBits: this.getBits(4n),
        NumLineBits: this.getBits(4n),
        ShapeRecords: this.getRecord("SHAPERECORD",FillBits,LineBits),
      }
      //see page 228
    },
    SHAPERECORD:(FillBits, LineBits)=>{
      let fill_bits = FillBits;
      let line_bits = LineBits;
      let record_list = [];
      while(true){
        let isLine = this.getBits(1)==1;
        if(isLine){
          
        }
        else{
          let flags = this.getBits(5);
          if(flags == 0){
            record_list.push({type:"End"});
            break;
          }
          let style_change_record = {
            type:"Style",
            HasMoveTo: flags & 0b00001 == 1,
            HasFillStyle0: flags & 0b00010 == 1,
            HasFillStyle1: flags & 0b00100 == 1,
            HasLineStyle: flags & 0b01000 == 1,
            HasNewStyles: flags & 0b10000 == 1,
          };
          if(style_change_record.HasMoveTo){
            //State MoveTo
            let bit_count = this.getBits(5);
            style_change_record.DeltaX = this.getRecord("SB", bit_count);
            style_change_record.DeltaY = this.getRecord("SB", bit_count);
          }
          if(style_change_record.HasFillStyle0){
            //fill style 0
            style_change_record.FillStyle0 = this.getBits(fill_bits);
          }
          if(style_change_record.HasFillStyle1){
            //fill style 1
            style_change_record.FillStyle1 = this.getBits(fill_bits);
          }
          if(style_change_record.HasLineStyle){
            //line style
            style_change_record.LineStyle = this.getBits(line_bits);
          }
          if(style_change_record.HasNewStyles){
            //new styles
            style_change_record.FillStyles = this.getRecord("FILLSTYLEARRAY");
            style_change_record.LINESTYLEARRAY = this.getRecord("LINESTYLEARRAY");
            style_change_record.FillBits = this.getBits(4);
            style_change_record.LineBits = this.getBits(4);
            fill_bits = style_change_record.FillBits;
            line_bits = style_change_record.LineBits;
          }
        }
      }
      return record_list;
    },
  };
  //recursive function to parse record data into a JS object
  getRecord(type, ...args){
    if(this.TYPE_SIGNATURES[type] == undefined) throw("unimplemented type: " + type);
    return this.TYPE_SIGNATURES[type](...args);
  }
  getRecordArray(type, n){
    let arr = [];
    for(let i = 0; i < n; i++){
      arr.push(this.getRecord(type));
    }
    return arr;
  }
}
class HTML_CANVAS_RENDERER{
  constructor(place){
    this.place = place;
  }
  initialise(width, height){
    this.target = document.createElement("canvas");
    this.target.width = width;
    this.target.height = height;
    this.place.appendChild(this.target);
    this.ctx = this.target.getContext("2d");
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
