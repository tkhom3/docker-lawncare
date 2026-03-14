import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="empty-state" style={{ color: '#ef4444' }}>
          Something went wrong loading this tab.
          <br />
          <small>{this.state.error.message}</small>
        </div>
      )
    }
    return this.props.children
  }
}
