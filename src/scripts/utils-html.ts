interface HtmlParam {
  tagName: string;
  classes?: string[];
  attributes?: {[key: string]: string};
  listeners?: {
    event: keyof HTMLElementEventMap;
    listener: (event?: Event) => void;
  }[];
  children?: CreateElementParam[];
}

interface HtmlTextParam {
  text: string;
}

export type CreateElementParam = HtmlParam | HtmlTextParam | Node | (() => (HtmlParam | HtmlTextParam | Node));

export class UtilsHtml {
  public static createElement(param: CreateElementParam): Node {
    if (typeof param === 'function') {
      param = param();
    }
    if (this.isElementParam(param)) {
      const element = document.createElement(param.tagName);

      if (param.classes) {
        element.className = param.classes.join(' ');
      }

      if (param.attributes) {
        for (const key in param.attributes) {
          if (Object.prototype.hasOwnProperty.call(param.attributes, key)) {
            element.setAttribute(key, param.attributes[key]);
          }
        }
      }

      if (param.listeners) {
        for (const listener of param.listeners) {
          element.addEventListener(listener.event, listener.listener);
        }
      }
      
      if (param.children) {
        for (const child of param.children) {
          if (child instanceof HTMLElement) {
            if (child.parentElement) {
              element.appendChild(child.cloneNode(true));
            } else {
              element.appendChild(child);
            }
          } else {
            element.appendChild(this.createElement(child));
          }
        }
      }

      return element;
    } else if (param instanceof Node) {
      return param;
    } else {
      return document.createTextNode(param.text);
    }
  }

  private static isElementParam(value: any): value is HtmlParam {
    return !!value?.tagName;
  }

  private static isTextParam(value: any): value is HtmlTextParam {
    return !!value?.text;
  }
}