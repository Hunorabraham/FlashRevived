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
            resolve({"data":byteView.slice(8), "version": byteView[3]});
            break;
          case 67: // C - ZLIB compression
            resolve({"data":READER.ZLIB_Decompress(byteView), "version": byteView[3]});
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
  static async ZLIB_Decompress(buffer){
    const decompression_target = new Blob(buffer);
    console.log(buffer);
    const ds = new DecompressionStream("deflate-raw");
    const decompressed_stream = decompression_target.stream().pipeThrough(ds);
    let destination_array = [];
    for await (const chunk of decompressed_stream){
        destination_array.push(chunk);
    }
    return destination_array;
  }
}