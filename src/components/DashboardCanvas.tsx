import { DashboardState, A2UIComponent } from '../types/a2ui';
import { MetricCard } from './a2ui/MetricCard';
import { CardGroup } from './a2ui/CardGroup';
import { DataTable } from './a2ui/DataTable';
import { AlertList } from './a2ui/AlertList';
import { StatusIndicator } from './a2ui/StatusIndicator';
import { ProgressBar } from './a2ui/ProgressBar';
import { VoiceOverlay } from './VoiceOverlay';
import { VoiceButton } from './VoiceButton';
import { VoiceState } from '../hooks/useVoiceDictation';

// Main Icon with optional gradient
const VennDiagramIcon = ({ className, gradient = false }: { className?: string; gradient?: boolean }) => (
  <svg
    className={className}
    viewBox="0 0 1024 432"
    fill={gradient ? "url(#main-gradient)" : "currentColor"}
    xmlns="http://www.w3.org/2000/svg"
  >
    {gradient && (
      <defs>
        <linearGradient id="main-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
      </defs>
    )}
    <path d="M223.303223,323.870300 C222.991089,340.296417 213.855331,349.911560 197.514267,350.761871 C193.147659,350.989105 191.198700,352.489777 189.596634,356.458221 C182.709076,373.519226 164.226059,383.935760 146.995972,380.881775 C127.471428,377.421082 113.681549,362.031921 112.812630,342.734039 C111.965828,323.927399 125.405685,306.697266 144.274582,302.399231 C162.664551,298.210327 182.050446,308.149689 189.396652,325.533813 C192.075836,331.873871 193.420303,332.798676 199.172028,331.611084 C204.302155,330.551880 204.620163,326.505280 204.611923,322.304291 C204.582779,307.472534 204.511215,292.639984 204.641205,277.809387 C204.671814,274.317902 203.598816,272.502106 200.119919,271.276459 C188.796783,267.287170 180.913788,259.453369 176.756470,248.200516 C175.365356,244.435104 173.354095,243.224960 169.398987,243.260513 C149.069382,243.443329 128.737076,243.368713 108.405861,243.319519 C92.877235,243.281937 82.780777,233.217804 82.589790,217.728714 C82.394661,201.903320 82.854240,186.076920 82.281013,170.246002 C82.146660,166.535553 80.925102,165.057419 77.738037,163.784210 C56.349380,155.239517 46.733646,133.294952 54.777489,111.760704 C60.981525,95.151825 79.785896,84.190361 97.239822,87.008522 C116.690460,90.149086 130.861649,105.650169 131.389740,124.363243 C131.915451,142.991425 123.032082,156.851532 105.850754,163.799988 C102.686256,165.079758 101.138397,166.562912 101.194176,170.296356 C101.423187,185.624802 101.272797,200.958633 101.313171,216.290344 C101.329948,222.662384 103.280602,224.626694 109.688316,224.638916 C129.519592,224.676758 149.352264,224.531982 169.181335,224.743774 C173.382553,224.788635 175.231842,223.336258 176.787445,219.476761 C183.312759,203.287277 195.894440,194.677856 213.013382,194.155167 C228.935684,193.668991 242.139526,200.829376 248.629120,215.427277 C252.460938,224.046722 257.281708,225.302750 265.201080,224.803055 C274.330994,224.226959 283.524872,224.588806 292.689514,224.682968 C295.539062,224.712250 297.108490,223.915924 298.170593,220.948730 C302.387512,209.167603 310.326660,200.870697 322.219543,196.520279 C323.655182,195.995117 325.876099,195.801117 325.524139,193.480515 C325.170044,191.145813 323.232513,190.213425 321.124054,190.137772 C315.965393,189.952682 310.798737,190.003479 305.636749,189.892441 C299.810303,189.767090 293.973389,189.749481 288.162415,189.363205 C277.000580,188.621231 267.888580,180.748993 266.000488,169.750641 C265.416229,166.347214 263.880066,165.083023 261.015839,163.950699 C244.778854,157.531693 234.546341,142.654724 234.783539,126.132912 C235.027313,109.151901 245.698380,94.617348 262.244476,88.729622 C287.939362,79.586433 315.392792,99.888290 314.489532,127.547661 C313.920288,144.979370 305.124573,156.902603 289.183960,163.724609 C287.691223,164.363464 285.973480,164.660492 284.731812,166.240372 C285.544495,170.119324 288.462799,170.739288 291.828400,170.734894 C300.660858,170.723389 309.493561,170.684937 318.325684,170.740570 C332.539612,170.830093 341.611816,177.819641 344.935760,191.553696 C345.569580,194.172592 346.647095,195.507675 349.111237,196.399750 C360.928284,200.677826 369.128845,208.722992 373.334076,220.605667 C374.382660,223.568665 375.956482,224.801270 379.162018,224.709152 C385.988831,224.512970 392.841888,224.374573 399.652435,224.765213 C404.317047,225.032776 405.972290,223.274231 406.730713,218.806076 C409.990387,199.602356 418.708313,183.110840 433.373260,170.275085 C458.279480,148.475433 487.026520,141.767227 518.511841,152.236160 C550.162354,162.760010 569.346619,185.329224 576.173035,218.002457 C577.212341,222.977081 578.752319,225.603363 584.083130,224.659241 C584.567871,224.573410 585.090881,224.583191 585.579468,224.657669 C592.923950,225.777206 597.073853,223.669983 600.520996,215.950790 C607.240479,200.903809 620.586731,193.675644 636.861084,194.163986 C654.025574,194.679016 666.466553,203.502396 672.889648,219.701340 C674.358398,223.405563 676.015076,224.882767 680.045593,224.748093 C689.034851,224.447708 698.042358,224.545059 707.038879,224.694321 C710.033936,224.744034 711.430908,223.571976 712.507996,220.838531 C719.104980,204.095627 733.001587,194.151413 749.770813,193.929901 C766.632263,193.707169 781.100525,203.914139 787.900146,221.130219 C788.944092,223.773407 790.270691,224.699982 792.998108,224.682556 C807.329468,224.591019 821.661987,224.695358 835.993347,224.605728 C841.235718,224.572952 843.577087,222.168015 843.639771,216.892578 C843.740723,208.394577 843.620117,199.894165 843.688049,191.395538 C843.811951,175.888489 854.018494,165.691803 869.387024,165.668304 C883.552307,165.646652 897.719238,165.531143 911.881653,165.729034 C915.646545,165.781662 917.455139,164.542679 918.782532,160.986282 C924.908203,144.573761 940.844177,133.992630 957.544189,134.891663 C975.528503,135.859833 990.101868,147.759247 994.748413,165.269562 C1000.003235,185.072205 988.603821,205.811798 968.723328,212.618622 C949.369080,219.245239 927.221741,209.690155 919.777283,190.896820 C917.688110,185.622620 915.109985,183.967911 909.597412,184.152237 C896.779724,184.580841 883.937805,184.268723 871.105835,184.299408 C864.541565,184.315109 862.436523,186.381104 862.384827,192.947769 C862.316589,201.613052 862.428711,210.279984 862.334229,218.944794 C862.184265,232.697876 851.669312,243.126053 837.820068,243.321548 C833.029602,243.389191 828.237366,243.332321 823.266907,243.332321 C823.266907,261.355255 823.264221,278.802765 823.268494,296.250275 C823.269836,301.583038 823.338745,306.916290 823.286743,312.248444 C823.244873,316.538513 825.282654,318.658997 829.554932,318.977081 C837.642883,319.579224 837.655884,319.626465 840.926514,312.076202 C847.549744,296.786469 864.987549,286.853363 881.587952,288.914093 C899.385864,291.123474 913.444336,304.222992 916.364441,321.318329 C919.895996,341.993408 907.836792,361.581360 888.230408,367.016693 C868.121887,372.591309 848.081299,362.751343 840.286987,343.013855 C838.534302,338.575531 835.880981,338.102295 831.897400,338.133850 C818.093018,338.243317 808.582581,331.662872 805.324097,319.919891 C804.206726,315.893005 804.104736,311.700531 804.099060,307.532135 C804.074158,289.200623 804.080872,270.869080 804.029785,252.537659 C804.007446,244.524796 797.417175,240.358536 790.089966,243.591217 C788.429504,244.323807 788.278381,245.881393 787.747437,247.221436 C781.103638,263.989410 768.653625,272.909088 750.785522,273.815338 C734.645874,274.633972 720.280090,265.001129 713.360596,248.834183 C711.567810,244.645432 709.472900,243.047653 704.900269,243.247742 C696.251099,243.626190 687.571838,243.448990 678.908569,243.298813 C675.942749,243.247406 674.326782,244.333939 673.356140,247.110992 C669.122925,259.222473 660.679260,267.225830 648.770752,271.640839 C646.167297,272.606018 645.235413,274.143677 645.260315,276.869141 C645.367004,288.533691 645.250000,300.200226 645.345947,311.864960 C645.387817,316.960236 647.248108,318.719849 652.283691,318.990753 C652.948547,319.026550 653.626343,318.932648 654.281555,319.021454 C663.807312,320.312622 670.105774,318.461365 675.022156,308.074310 C682.741943,291.764648 703.194275,285.024261 720.079102,290.418152 C739.135864,296.505859 749.956665,313.051270 748.268860,333.521423 C746.896118,350.171051 732.237549,365.404205 714.983154,368.111908 C696.764709,370.970886 678.888550,361.066833 671.882812,343.710724 C670.148193,339.413452 667.988708,337.870514 663.445984,338.097778 C658.151123,338.362671 652.779663,338.721771 647.492432,337.738068 C634.549683,335.330139 626.738525,326.114258 626.618896,313.005341 C626.512451,301.340912 626.470093,289.674896 626.542053,278.010437 C626.564148,274.427216 625.433777,272.475677 621.747986,271.153320 C610.654175,267.173157 602.829407,259.468719 598.788940,248.341476 C597.437561,244.619629 595.574463,242.927612 591.523804,243.298828 C587.230347,243.692352 582.134460,242.212219 578.776123,244.064865 C575.149841,246.065292 576.148010,251.843658 575.107117,255.956924 C566.733582,289.045105 536.624695,315.016937 502.895538,319.501465 C457.080139,325.592926 413.876740,293.816589 406.630402,248.425110 C406.013916,244.563553 404.402161,243.093307 400.408142,243.270172 C393.588898,243.572159 386.739502,243.536041 379.916626,243.277161 C376.155823,243.134445 374.365479,244.492950 372.996735,248.038269 C362.887573,274.223450 330.732971,282.196564 309.493500,263.878510 C304.486786,259.560425 300.684082,254.279434 298.685211,247.938110 C297.627533,244.582596 295.956329,243.190979 292.260803,243.263123 C280.599854,243.490784 268.929291,243.460312 257.267303,243.255219 C253.823792,243.194656 252.284180,244.461105 251.145767,247.616455 C247.073303,258.904572 239.270569,266.839111 228.076324,271.044769 C224.218948,272.493988 223.167572,274.523651 223.219482,278.406982 C223.419861,293.398804 223.302200,308.394897 223.303223,323.870300 M552.980713,261.488159 C557.107178,252.041260 558.966797,242.217056 558.800537,231.859543 C558.144043,190.966675 518.524170,159.319229 478.447235,167.845276 C441.317108,175.744415 418.129120,210.212006 425.518768,247.559952 C431.583679,278.212769 458.538971,301.801544 491.758057,301.331360 C519.633118,300.936829 540.050476,287.177460 552.980713,261.488159 M209.281494,254.547989 C210.939285,254.634781 212.597916,254.809616 214.254715,254.793533 C222.697769,254.711670 230.108948,249.655838 233.280365,241.874069 C236.433853,234.136246 234.653061,225.206497 228.773682,219.275436 C222.709534,213.157974 213.575394,211.280212 205.760056,214.544388 C197.693970,217.913315 192.942078,225.213745 193.000931,234.146591 C193.065018,243.871262 197.927917,250.216141 209.281494,254.547989 M254.078735,124.744972 C252.591446,140.767548 267.582458,149.032578 277.403961,147.527130 C288.622467,145.807541 296.195374,136.503601 295.686005,125.055206 C295.227875,114.758530 285.972076,105.792786 275.409485,105.414101 C264.876160,105.036476 255.840805,112.878212 254.078735,124.744972 M889.197693,345.792694 C890.332947,344.823029 891.570801,343.949677 892.586792,342.867981 C898.801758,336.250916 900.001831,326.258820 895.593079,318.374603 C891.507690,311.068726 882.207031,306.382812 874.611328,307.742889 C865.104065,309.445251 858.841797,314.961182 856.759949,324.294556 C854.913818,332.571381 857.583862,339.865082 864.408325,345.098236 C872.096802,350.994019 880.278503,351.248230 889.197693,345.792694 M166.238815,325.214691 C163.612015,323.078278 160.608246,321.696716 157.354630,320.846924 C149.453217,318.783203 140.760437,322.226959 135.527893,329.468079 C130.849487,335.942322 130.642548,345.517090 135.029297,352.538818 C139.440674,359.599976 148.107513,363.455780 156.006638,361.998505 C164.701660,360.394379 170.489746,355.384064 172.904465,346.976166 C175.262024,338.767365 173.080536,331.556152 166.238815,325.214691 M349.392426,249.932419 C350.316193,248.979904 351.317322,248.090378 352.151642,247.065063 C359.833160,237.624924 357.816559,223.694611 347.796631,216.796051 C337.589661,209.768738 323.585236,212.915543 317.553009,223.591766 C312.953125,231.733032 314.633209,242.945053 321.400665,249.268646 C328.903687,256.279572 339.447998,256.714081 349.392426,249.932419 M694.100647,313.586365 C693.435059,314.329010 692.690979,315.015717 692.116150,315.823029 C687.065002,322.917358 685.854492,330.511475 690.135559,338.286865 C694.314148,345.876068 700.949219,350.177826 709.752502,349.564392 C718.593689,348.948273 725.026184,344.307312 728.335754,335.884064 C731.710510,327.294891 728.755798,317.492859 721.222290,311.865082 C712.973389,305.702850 703.544983,306.140167 694.100647,313.586365 M83.847656,107.212067 C82.666893,107.816620 81.421974,108.322449 80.315575,109.041428 C71.907722,114.505112 68.552780,125.346390 72.387619,134.516739 C76.297211,143.865875 86.413849,149.333008 95.819664,147.179657 C107.687645,144.462601 115.187119,132.764252 112.206795,121.617561 C108.914200,109.302948 97.497437,103.236160 83.847656,107.212067 M965.109985,193.780838 C977.047302,186.988861 980.663452,173.324081 973.307861,162.802490 C966.394836,152.913971 952.030945,151.055588 942.474060,158.813202 C935.061829,164.830063 932.943848,176.575195 937.735596,185.090927 C943.074280,194.578506 953.423706,198.072006 965.109985,193.780838 M730.657959,241.660873 C734.271912,249.587387 740.156494,254.341248 749.087219,254.787735 C758.020691,255.234375 764.639282,251.259201 768.658020,243.518311 C772.469238,236.177109 772.049561,228.701096 767.253174,221.772308 C761.567871,213.559418 750.112732,210.715790 740.931763,215.114334 C731.491516,219.637115 727.218872,230.110260 730.657959,241.660873 M642.185974,214.058762 C639.638428,213.028763 636.959839,213.121918 634.302734,213.223709 C623.291504,213.645508 614.923279,222.639023 614.956848,233.960861 C614.990784,245.403976 623.708496,254.548538 634.822632,254.799301 C645.537598,255.041046 654.284424,248.174225 656.439575,237.828568 C658.440002,228.225983 653.031616,218.801376 642.185974,214.058762 z"/>
    <path d="M481.287659,229.788239 C486.191010,235.125137 486.206116,236.418396 481.468262,241.180161 C475.247711,247.432129 469.016754,253.674484 462.725800,259.855377 C460.543579,261.999420 457.956696,264.328918 455.014923,261.430786 C452.197418,258.655029 454.001282,255.907074 456.226746,253.616837 C461.212921,248.485672 466.164978,243.315201 471.318085,238.355194 C473.695221,236.067093 473.583832,234.466583 471.248596,232.244202 C466.187531,227.427856 461.349731,222.377289 456.404724,217.438446 C454.136078,215.172699 452.116913,212.524307 454.922699,209.718002 C457.730774,206.909348 460.398254,208.942017 462.657013,211.195633 C468.782684,217.307404 474.906860,223.420670 481.287659,229.788239 z"/>
    <path d="M529.783936,262.376038 C517.971741,263.636139 506.515991,262.982422 495.070770,262.876648 C492.336365,262.851379 490.112122,261.363770 490.131042,258.331055 C490.150513,255.203705 492.619202,254.012360 495.249664,253.979340 C506.046173,253.843842 516.845703,253.878098 527.643188,253.961929 C529.735535,253.978149 531.571777,254.953751 532.232788,257.158417 C532.882935,259.326965 532.166382,261.073425 529.783936,262.376038 z"/>
  </svg>
);

interface ShortcutAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface CommandAction {
  id: string;
  label: string;
}

interface VoiceInputProps {
  voiceState: VoiceState;
  transcript: string;
  onStartListening: () => void;
  onStopListening: () => void;
  isSupported: boolean;
}

interface DashboardCanvasProps {
  state: DashboardState;
  shortcuts?: ShortcutAction[];
  currentView?: 'home' | 'commands' | 'loading';
  onBack?: () => void;
  commands?: CommandAction[];
  onCommandClick?: (query: string) => void;
  voiceInput?: VoiceInputProps;
}

// Component registry - maps A2UI component types to React components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
  metric_card: MetricCard,
  card_group: CardGroup,
  data_table: DataTable,
  alert_list: AlertList,
  status_indicator: StatusIndicator,
  progress_bar: ProgressBar,
};

function renderComponent(component: A2UIComponent, index: number) {
  const Component = COMPONENT_REGISTRY[component.component];

  if (!Component) {
    console.warn(`Unknown component type: ${component.component}`);
    return null;
  }

  const colSpanClass = component.columnSpan ? `col-span-${component.columnSpan}` : '';

  return (
    <div
      key={component.id || index}
      className={`animate-slide-up h-full ${colSpanClass}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <Component component={component} className="h-full" />
    </div>
  );
}

// Default commands for the commands screen
// These are example queries that users can click to send to the chat
const DEFAULT_COMMANDS: CommandAction[] = [
  { id: 'show-all-metrics', label: 'Show all system metrics' },
  { id: 'container-status', label: 'Which containers are using the most memory?' },
  { id: 'workflow-health', label: 'Are my n8n workflows healthy?' },
  { id: 'disk-space', label: 'How much disk space is left?' },
  { id: 'cpu-spike', label: 'What is causing high CPU usage?' },
  { id: 'restart-n8n', label: 'How do I restart the n8n container?' },
  { id: 'failed-workflows', label: 'Show me failed workflow executions' },
  { id: 'show-deployments', label: 'Show deployments' },
  { id: 'deployment-count', label: 'How many deployments do I have?' },
  { id: 'last-deployment', label: 'When was my last deployment?' },
];

export function DashboardCanvas({ state, shortcuts, currentView = 'home', onBack, commands = DEFAULT_COMMANDS, onCommandClick, voiceInput }: DashboardCanvasProps) {
  const { components, lastUpdated, agentMessage } = state;

  // Determine if voice is active (listening or transcribing)
  const isVoiceActive = voiceInput && voiceInput.voiceState !== 'idle';

  // Loading screen view
  if (currentView === 'loading') {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="flex items-center gap-3 text-text-secondary">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-lg">Loading...</span>
        </div>
      </div>
    );
  }

  // Commands screen view
  if (currentView === 'commands') {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Choose any of the following
        </h2>
        <p className="text-text-secondary max-w-md mb-8">
          Or, use chat to find what you want
        </p>

        {/* Command Pills */}
        <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
          {commands.map((command) => (
            <button
              key={command.id}
              onClick={() => onCommandClick?.(command.label)}
              className="px-5 py-2.5 bg-white/70 hover:bg-white/90 backdrop-blur-sm border border-white/50 hover:border-accent-primary/50 rounded-full transition-all duration-200 text-sm font-medium text-text-primary hover:text-accent-primary shadow-sm hover:shadow-md"
            >
              {command.label}
            </button>
          ))}
        </div>

        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="mt-8 text-sm text-text-secondary hover:text-accent-primary transition-colors"
          >
            Back to home
          </button>
        )}
      </div>
    );
  }

  if (components.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        {/* Header - Always visible */}
        <VennDiagramIcon className="w-96 h-auto mb-8" gradient />
        <h2 className="text-4xl font-normal text-text-primary mb-3">
          Command Central
        </h2>
        <p className="text-text-secondary max-w-md mb-8 text-lg">
          Choose an option below or use the chat
        </p>

        {/* Voice Content Area - switches between cards and voice overlay */}
        <div className="relative w-full max-w-4xl min-h-[200px] flex flex-col items-center justify-center">
          {/* Shortcut Cards - Fade out during voice input */}
          {shortcuts && shortcuts.length > 0 && (
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full transition-all duration-300 ${
                isVoiceActive ? 'opacity-0 pointer-events-none absolute' : 'opacity-100'
              }`}
            >
              {shortcuts.map((shortcut) => (
                <button
                  key={shortcut.id}
                  onClick={shortcut.onClick}
                  className="group p-6 bg-white/70 hover:bg-white/90 backdrop-blur-sm border border-white/50 hover:border-accent-primary/50 rounded-xl transition-all duration-200 text-left shadow-sm hover:shadow-md"
                >
                  <div className="w-12 h-12 rounded-lg bg-white/60 group-hover:bg-accent-primary/20 flex items-center justify-center mb-4 transition-colors">
                    <span className="text-text-muted group-hover:text-accent-primary transition-colors">
                      {shortcut.icon}
                    </span>
                  </div>
                  <h3 className="font-semibold text-text-primary mb-1">
                    {shortcut.title}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {shortcut.description}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Voice Overlay - Fade in during voice input */}
          {voiceInput && (
            <div
              className={`w-full transition-all duration-300 ${
                isVoiceActive ? 'opacity-100' : 'opacity-0 pointer-events-none absolute'
              }`}
            >
              <VoiceOverlay
                voiceState={voiceInput.voiceState}
                transcript={voiceInput.transcript}
              />
            </div>
          )}
        </div>

        {/* Voice Button - Always visible, centered below content */}
        {voiceInput && voiceInput.isSupported && (
          <div className="mt-8">
            <VoiceButton
              voiceState={voiceInput.voiceState}
              onStart={voiceInput.onStartListening}
              onStop={voiceInput.onStopListening}
            />
          </div>
        )}
      </div>
    );
  }

  // Group components by layout
  // Featured components go at the top in a 2-column layout (card on left, table on right)
  const featuredIds = ['running-containers-count', 'containers-list-table', 'deployment-count', 'deployments-table'];
  const featuredComponents = components
    .filter(c => featuredIds.includes(c.id))
    .sort((a, b) => featuredIds.indexOf(a.id) - featuredIds.indexOf(b.id));

  // Small components (metric_card, status_indicator, progress_bar) - excluding featured
  const smallComponents = components.filter(c =>
    ['metric_card', 'status_indicator', 'progress_bar'].includes(c.component) &&
    !featuredIds.includes(c.id)
  );

  // Card groups get their own 2-column layout (automations, container groups)
  const cardGroupComponents = components.filter(c =>
    c.component === 'card_group' && !featuredIds.includes(c.id)
  );

  // Large components (data_table, alert_list) - excluding featured
  const largeComponents = components.filter(c =>
    ['data_table', 'alert_list'].includes(c.component) &&
    !featuredIds.includes(c.id)
  );

  return (
    <div className="space-y-6">
      {/* Agent message */}
      {agentMessage && (
        <div className="p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm">
          <p className="text-sm text-text-secondary">{agentMessage}</p>
        </div>
      )}

      {/* Featured components - layout depends on content */}
      {featuredComponents.length > 0 && (
        (() => {
          // Check if this is a deployment view (metric card + table)
          const isDeploymentView = featuredComponents.some(c => c.id === 'deployment-count');

          if (isDeploymentView) {
            // Deployment view: 1 column for card, 3 columns for table (1/4 + 3/4)
            return (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
                {featuredComponents.map((component, index) => {
                  const Component = COMPONENT_REGISTRY[component.component];
                  const isTable = component.component === 'data_table';
                  return (
                    <div
                      key={component.id || index}
                      className={`animate-slide-up h-full ${isTable ? 'lg:col-span-3' : ''}`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {Component ? <Component component={component} className="h-full" /> : null}
                    </div>
                  );
                })}
              </div>
            );
          }

          // Default: 2-column layout
          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              {featuredComponents.map((component, index) => (
                <div
                  key={component.id || index}
                  className="animate-slide-up h-full"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {(() => {
                    const Component = COMPONENT_REGISTRY[component.component];
                    return Component ? <Component component={component} className="h-full" /> : null;
                  })()}
                </div>
              ))}
            </div>
          );
        })()
      )}

      {/* Card groups - 2 column layout (automations, container groups) */}
      {cardGroupComponents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cardGroupComponents.map((component, index) => (
            <div key={component.id || index}>
              {renderComponent(component, featuredComponents.length + index)}
            </div>
          ))}
        </div>
      )}

      {/* Small components grid - equal height per row */}
      {smallComponents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
          {smallComponents.map((component, index) => (
            <div key={component.id || index}>
              {renderComponent(component, featuredComponents.length + cardGroupComponents.length + index)}
            </div>
          ))}
        </div>
      )}

      {/* Large components */}
      {largeComponents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {largeComponents.map((component, index) =>
            renderComponent(component, featuredComponents.length + cardGroupComponents.length + smallComponents.length + index)
          )}
        </div>
      )}

      {/* Footer with last update time */}
      <div className="text-xs text-text-muted text-right pt-4 border-t border-white/30">
        Last updated: {new Date(lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
}
