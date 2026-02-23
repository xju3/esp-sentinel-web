
  // 1. KaTeX 渲染示例 (在 ISO 标准描述中渲染公式)
  const katexContainer = document.getElementById('katex-formula');
  const hilbertFormulaContainer = document.getElementById('hilbert-formula');
  if (katexContainer) {
    katex.render("v_{RMS} = \\sqrt{\\frac{1}{T} \\int_{0}^{T} v^2(t) dt}", katexContainer, {
      throwOnError: false,
      displayMode: false
    });
  }

  // 1.1 FFT公式渲染
  const fftFormulaContainer = document.getElementById('fft-formula');
  if (fftFormulaContainer) {
    katex.render("X(k) = \\sum_{n=0}^{N-1} x(n) \\cdot e^{-j \\frac{2\\pi}{N} nk}, \\quad k = 0, \\dots, N-1", fftFormulaContainer, {
      throwOnError: false,
      displayMode: false
    });
  }

  // 1.2 希尔伯特变换公式渲染
  if (hilbertFormulaContainer) {
    katex.render("\\hat{x}(t) = \\frac{1}{\\pi} \\int_{-\\infty}^{\\infty} \\frac{x(\\tau)}{t - \\tau} d\\tau", hilbertFormulaContainer, {
      throwOnError: false,
      displayMode: false
    });
  }

  // 1.3 峭度公式渲染
  const kurtosisFormulaContainer = document.getElementById('kurtosis-formula');
  if (kurtosisFormulaContainer) {
    katex.render("K = \\frac{\\frac{1}{N} \\sum_{i=1}^{N} (x_i - \\bar{x})^4}{(\\frac{1}{N} \\sum_{i=1}^{N} (x_i - \\bar{x})^2)^2}", kurtosisFormulaContainer, {
      throwOnError: false,
      displayMode: false
    });
  }