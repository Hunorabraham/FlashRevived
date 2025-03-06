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
  static read(file){
    let fr = new FileReader();
    fr.readAsArrayBuffer(file);
    return new Promise((resolve, reject)=>{
      fr.onload = ()=>{
        const byteView = new Uint8Array(fr.result);
        //console.log(fr.result);
        switch(byteView[0]){
          case 83: // S - uncompressed
            resolve({"data":byteView.slice(8), "version": byteView[3]});
            break;
          case 67: // C - ZLIB compression
            let zd = new ZLIB_DECODER(fr.result.slice(8));
            if(zd.inflate() !== "OK"){
              console.error("extraction error: ", zd.error_message);
              return;
            }
            return {"data":zd.result, "version": byteView[3]};
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
}