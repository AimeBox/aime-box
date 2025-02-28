import React, { useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';
import { Responsive, WidthProvider, Layout, Layouts } from 'react-grid-layout';

const ResponsiveReactGridLayout = WidthProvider(Responsive);

interface ShowcaseLayoutProps {
  onLayoutChange?: (layout: Layout[], layouts: Layouts) => void;
  className?: string;
  rowHeight?: number;
  cols?: { [key: string]: number };
  initialLayout?: Layout[];
}

interface ShowcaseLayoutState {
  currentBreakpoint: string;
  compactType: 'horizontal' | 'vertical' | null;
  mounted: boolean;
  layouts: Layouts;
}

function generateLayout() {
  return _.map(_.range(0, 25), function (item, i) {
    const y = Math.ceil(Math.random() * 1);
    return {
      x: (_.random(0, 5) * 2) % 12,
      y: Math.floor(i / 6) * y,
      w: 2,
      h: y,
      i: i.toString(),
      static: Math.random() < 0.05,
    };
  });
}

export default function ShowcaseLayout(props: ShowcaseLayoutProps) {
  const {
    className = 'layout',
    rowHeight = 30,
    onLayoutChange,
    cols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
    initialLayout = generateLayout(),
  } = props;

  const [state, setState] = useState<ShowcaseLayoutState>({
    currentBreakpoint: 'lg',
    compactType: 'vertical',
    mounted: false,
    layouts: { lg: initialLayout || [] },
  });

  const onBreakpointChange = (breakpoint: string) => {
    setState({ ...state, currentBreakpoint: breakpoint });
  };

  // const onLayoutChange = (layout: Layout[], layouts: Layouts) =>{
  //   this.props.onLayoutChange(layout, layouts);
  // }

  const generateDOM = () => {
    return _.map(state.layouts.lg, (l, i) => {
      return (
        <div key={i} className={`${l.static ? 'static' : ''}`}>
          {l.static ? (
            <span
              className="text"
              title="This item is static and cannot be removed or resized."
            >
              Static - {i}
            </span>
          ) : (
            <span className="text">{i}</span>
          )}
        </div>
      );
    });
  };
  return (
    <div>
      <ResponsiveReactGridLayout
        {...props}
        layouts={state.layouts}
        onBreakpointChange={onBreakpointChange}
        onLayoutChange={onLayoutChange}
        // WidthProvider option
        measureBeforeMount={false}
        // I like to have it animate on mount. If you don't, delete `useCSSTransforms` (it's default `true`)
        // and set `measureBeforeMount={true}`.
        useCSSTransforms={state.mounted}
        compactType={state.compactType}
        preventCollision={!state.compactType}
      >
        {generateDOM()}
      </ResponsiveReactGridLayout>
    </div>
  );
}

// export class ShowcaseLayout2 extends React.Component<
//   ShowcaseLayoutProps,
//   ShowcaseLayoutState
// > {
//   static propTypes = {
//     onLayoutChange: PropTypes.func.isRequired,
//   };

//   static defaultProps = {
//     className: 'layout',
//     rowHeight: 30,
//     onLayoutChange: () => {},
//     cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
//     initialLayout: generateLayout(),
//   };

//   constructor(props: ShowcaseLayoutProps) {
//     super(props);
//     this.state = {
//       currentBreakpoint: 'lg',
//       compactType: 'vertical',
//       mounted: false,
//       layouts: { lg: props.initialLayout || [] },
//     };

//     this.onBreakpointChange = this.onBreakpointChange.bind(this);
//     this.onCompactTypeChange = this.onCompactTypeChange.bind(this);
//     this.onLayoutChange = this.onLayoutChange.bind(this);
//     this.onNewLayout = this.onNewLayout.bind(this);
//   }

//   componentDidMount() {
//     this.setState({ mounted: true });
//   }

//   generateDOM() {
//     return _.map(this.state.layouts.lg, (l, i) => {
//       return (
//         <div key={i} className={l.static ? 'static' : ''}>
//           {l.static ? (
//             <span
//               className="text"
//               title="This item is static and cannot be removed or resized."
//             >
//               Static - {i}
//             </span>
//           ) : (
//             <span className="text">{i}</span>
//           )}
//         </div>
//       );
//     });
//   }

//   onBreakpointChange(breakpoint: string) {
//     this.setState({
//       currentBreakpoint: breakpoint,
//     });
//   }

//   onCompactTypeChange() {
//     const { compactType: oldCompactType } = this.state;
//     const compactType =
//       oldCompactType === 'horizontal'
//         ? 'vertical'
//         : oldCompactType === 'vertical'
//           ? null
//           : 'horizontal';
//     this.setState({ compactType });
//   }

//   onLayoutChange(layout: Layout[], layouts: Layouts) {
//     this.props.onLayoutChange(layout, layouts);
//   }

//   onNewLayout() {
//     this.setState({
//       layouts: { lg: generateLayout() },
//     });
//   }
//   [state];
//   render() {
//     return (

//     );
//   }
// }
