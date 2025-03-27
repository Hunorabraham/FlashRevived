class Tag{
  constructor(type, length){
    this.type = type;
    this.length = length;
  }
}

let iter = 0;
/**
 * I don't want to bother with modules and stuff, confession: I have no clue how to make them work, I tried and failed
*/
class READER{
  static hello(){console.log("hello, testing complete..."); console.error("THERE ARE ALWAYS ERRORS");}
  static read(file, testData){
    let fr = new FileReader();
    fr.readAsArrayBuffer(file);
    return new Promise((resolve, reject)=>{
      fr.onload = ()=>{
        const byteView = new Uint8Array(fr.result);
        switch(byteView[0]){
          case 70: // S - uncompressed
            resolve(byteView);
            break;
          case 67: // C - ZLIB compression
            console.log(`Version: ${byteView[3]}; Exctracted size: ${READER.littleEndianInt32(byteView.slice(4,8))}`);
            let zd = new ZLIB_DECODER(fr.result, READER.littleEndianInt32(byteView.slice(4,8)));
            if(testData != undefined) zd.addTestData(testData);
            if(!zd.inflate()){
              reject("extraction error: " + zd.error_message);
              return;
            }
            resolve(zd.result);
            break;
          case 90: // Z - the newer compression type I'm not brave enough to tackle right now
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
  static littleEndianInt32(bytes){
    let int32 = 0;
    for(let i = 0; i < 4; i++){
      int32 += bytes[i] << (i*8);
    }
    return int32;
  }
}
