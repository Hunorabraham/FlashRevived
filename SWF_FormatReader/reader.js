class Tag{
  constructor(type, length){
    this.type = type;
    this.length = length;
  }
}
/**
 * I don't want to bother with modules and stuff, confession: I have no clue how to make them work, I tried and failed
*/
class READER{
  static hello(){console.log("hello, testing complete..."); console.error("THERE ARE ALWAYS ERRORS");}
  static read(file){
    let fr = new FileReader();
    fr.readAsArrayBuffer(file);
    return new Promise((resolve, reject)=>{
      fr.onload = ()=>{
        const byteView = new Uint8Array(fr.result);
        switch(byteView[0]){
          case 83: // S - uncompressed
            resolve(byteView);
            break;
          case 67: // C - ZLIB compression
            resolve(READER.ZLIB_Decompress(byteView));
            break;
          case 90: // 
            reject("Not yet implemented");
            break;
          default:
            reject("Unrecognised signature: " + byteView[0]);
            break;
        }
      }
      fr.onerror = (error)=>{
        reject(error);
      }
    });
  }
  static ZLIB_Decompress(buffer){
    return "Uh oh";
  }
}
//STOP, don't implement yet >:(