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
  }
  test(){
    this.renderer.draw_general_debug("fillRect", 10,10,100,100);
  }
}
class HTML_CANVAS_RENDERER{
  constructor(target){
    this.can = target;
    this.ctx = target.getContext("2d");
  }
  /*
  *for debugging only please don't use
  */
  draw_general_debug(func_name, ...args){
    console.log("draw call: " + func_name + "\nargs:", ...args);
    this.ctx[func_name](...args);
  }
}
