class Tag{
  constructor(type, length){
    this.type = type;
    this.length = length;
  }
}
class Character(){
  constructor(ID, type, content){
    this.ID = ID;
    this.type = type;
    this.content = content;
    this.depth_value = 0; //set later? perhaps redundant
  }
}
class Reader{
  constructor(){
    this.dictionary = {};
    this.display_list = [];
  }
  
}
//STOP, don't implement yet >:(