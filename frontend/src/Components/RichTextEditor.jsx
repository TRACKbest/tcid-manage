import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

const editorModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['blockquote', 'code-block', 'link'],
    ['clean'],
  ],
}

const editorFormats = ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'align', 'blockquote', 'code-block', 'link']

const RichTextEditor = ({ value, onChange, placeholder }) => (
  <ReactQuill
    theme="snow"
    value={value || ''}
    onChange={onChange}
    modules={editorModules}
    formats={editorFormats}
    placeholder={placeholder}
  />
)

export default RichTextEditor
