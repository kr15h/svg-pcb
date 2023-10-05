import { html, svg } from "lit-html";
import { dispatch } from "../dispatch.js";
import * as esprima from 'esprima';

export const layersColorPicker = (state) => html`
    <div 
      class="toolbox-title"
      @click=${e => {
            document.querySelector(".layer-list-inner").classList.toggle("hidden");
            e.target.classList.toggle("inner-hidden");
          }}>Layers:</div>
    <div class="layer-list-inner">
      ${state.layers
        .map((layer, i) => { 
          const { name, visible, color: hex } = layer;

          const getCode = () => state.codemirror.view.state.doc.toString();
          const code = getCode();
          const snippet = code.slice(state.layersStaticInfo.from, state.layersStaticInfo.to);

          const updateCode = () => {
            const tree = esprima.parse(snippet, { range: true });
            const range = findNode(tree, { type: "Identifier", name: "layerColors" } )
              .getParent()
              .value
              .range;

            const from = range[0]+state.layersStaticInfo.from;
            const to = range[1]+state.layersStaticInfo.from;

            state.codemirror.view.dispatch({
              changes: { from, to, insert: layerObjToStr(state.layers)}
            })
            
            // find every shape on this layer and change it
            // update the code

            dispatch("RUN");
          }

          const getOpacity = n => (parseInt(n, 16)/255).toFixed(2);

          const color = hex.slice(0, -2);
          const opacity = getOpacity(hex.slice(-2));

          const onOpacityChange = (e) => {
            let opacityHex = Math.floor((Number(e.target.value)*255)).toString(16);
            while (opacityHex.length < 2) opacityHex = "0" + opacityHex;

            layer.color = color + opacityHex;
            updateCode();
          }

          const onColorChange = (e) => {
            let opacityHex = hex.slice(-2);
            layer.color = e.target.value + opacityHex;

            updateCode();
          }

          const onCommentInput = (e) => {

            const shiftHeld = [...state.heldKeys].some(key => key.includes("Shift"));

            if (shiftHeld) {
              state.layers.forEach(l => {
                l.visible = false;
              })

              layer.visible = e.target.checked;
              
              updateCode();

            } else {

              layer.visible = e.target.checked;
              
              updateCode();
            }
            
          }

          const colorInput = visible ? html`
            <span class="layer-color">
              <input @input=${onColorChange} class="color-input" type="color" style="opacity: ${opacity};" value=${color}/>
              <span class="opacity-input">
                ${opacity}
                <input @input=${onOpacityChange} type="range" min="0" max="1" step="0.01" value=${opacity}/>
              </span>
            </span>
          ` : "";

          // const colorInput = visible ? html`
          //   <div 
          //     @input=${onColorChange} 
          //     style="
          //       background: ${color};
          //       opacity: ${opacity};
          //       margin-right: 5px;
          //       width: 20px;
          //       height: 20px;
          //       border: 1px solid black;
          //       " 
          //     >
          //     </div>
          // ` : "";

          return html`
            <div class="layer-item" .data=${{ index: i, layers: state.layers, updateCode }}>
              <div style="margin-bottom: 2px;" class="layer-grabber">≡</div>
              <div style="flex: 1; padding-left: 5px; display: flex; align-items: center; justify-content: space-between;">
                <span class="layer-name">
                  <input @input=${onCommentInput} type="checkbox" .checked=${visible}/>
                  <span>${name}</span>
                </span>
                ${colorInput}
              </div>
            </div>
          `
        }).reverse()}
      </div>
`

function layerObjToStr(obj) {
    let result = [];

   obj.forEach( layer => {
      const { visible, name, color } = layer;
 
        const value = visible
          ? ` "${name}": "${color}",`
          : `/* "${name}": "${color}", */`;
        result.push(value);
        
    });

    return '{\n' + result.join(`\n`) + '\n}';
}

function findNode(ast, obj, parent = null) {
  if (typeof ast !== 'object' || ast === null) return null;

  // Add the getParent property to the current node
  Object.defineProperty(ast, 'getParent', {
      value: function() {
          return parent;
      },
      enumerable: false,  // To avoid this property showing up in loops or JSON.stringify
      writable: false
  });

  // Check if the current node matches the search object
  let isMatch = true;
  for (const key in obj) {
    if (ast[key] !== obj[key]) {
      isMatch = false;
      break;
    }
  }

  if (isMatch) return ast;

  // If not, continue searching its children
  for (const key in ast) {
    const childNode = findNode(ast[key], obj, ast);
    if (childNode) return childNode;
  }
  
  return null;
}